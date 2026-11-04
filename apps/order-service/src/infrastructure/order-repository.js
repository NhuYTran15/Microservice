import pg from 'pg';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.ORDER_DATABASE_URL });

const selectOrder = `
  SELECT o.oid, o.uid, o.discount, o.subtotal, o.total_amount, o.status, o.created_at,
         COALESCE(json_agg(json_build_object(
           'pid', d.pid, 'pname', d.pname, 'qty', d.qty, 'unit_price', d.unit_price
         ) ORDER BY d.pid) FILTER (WHERE d.pid IS NOT NULL), '[]') AS items
  FROM orders o
  LEFT JOIN order_details d ON d.oid = o.oid
`;

function normalize(row) {
  return {
    oid: row.oid,
    uid: row.uid,
    discount: Number(row.discount),
    subtotal: Number(row.subtotal),
    total_amount: Number(row.total_amount),
    status: row.status,
    shipment_status: 'PENDING_CREATION',
    shipment_lookup: `/api/orders/${row.oid}/shipment`,
    created_at: new Date(row.created_at).toISOString(),
    items: row.items.map((item) => ({ ...item, unit_price: Number(item.unit_price) })),
  };
}

export async function saveOrder({ uid, discount, subtotal, totalAmount, reservationId, eventId, items }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `INSERT INTO orders(uid, discount, subtotal, total_amount, reservation_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING oid, created_at`,
      [uid, discount, subtotal, totalAmount, reservationId],
    );
    const { oid, created_at } = orderResult.rows[0];
    for (const item of items) {
      await client.query(
        `INSERT INTO order_details(oid, pid, pname, qty, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [oid, item.pid, item.pname, item.qty, item.unit_price],
      );
    }
    const event = {
      event_id: eventId,
      event_type: 'OrderCreated',
      occurred_at: new Date().toISOString(),
      data: { oid, uid, discount, subtotal, total_amount: totalAmount, items },
    };
    await client.query(
      `INSERT INTO outbox_events(event_id, aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, 'Order', $2, 'OrderCreated', $3::jsonb)`,
      [eventId, String(oid), JSON.stringify(event)],
    );
    await client.query('COMMIT');
    return {
      oid, uid, discount, subtotal, total_amount: totalAmount, status: 'CREATED',
      shipment_status: 'PENDING_CREATION', shipment_lookup: `/api/orders/${oid}/shipment`,
      created_at: new Date(created_at).toISOString(), items,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrder(oid) {
  const result = await pool.query(`${selectOrder} WHERE o.oid = $1 GROUP BY o.oid`, [oid]);
  return result.rows[0] ? normalize(result.rows[0]) : null;
}

export async function listOrders(uid, isAdmin) {
  const where = isAdmin ? '' : 'WHERE o.uid = $1';
  const values = isAdmin ? [] : [uid];
  const result = await pool.query(`${selectOrder} ${where} GROUP BY o.oid ORDER BY o.created_at DESC`, values);
  return result.rows.map(normalize);
}

export async function pendingOutboxEvents(limit = 20) {
  const result = await pool.query(
    `SELECT event_id, aggregate_id, payload FROM outbox_events
     WHERE status = 'PENDING' ORDER BY created_at LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function markOutboxPublished(eventId) {
  await pool.query(
    `UPDATE outbox_events SET status = 'PUBLISHED', attempts = attempts + 1, published_at = NOW()
     WHERE event_id = $1`,
    [eventId],
  );
}

export async function markOutboxAttempt(eventId) {
  await pool.query('UPDATE outbox_events SET attempts = attempts + 1 WHERE event_id = $1', [eventId]);
}

