import pg from 'pg';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.CUSTOMER_DATABASE_URL });

const selectCustomer = `
  SELECT c.uid, c.fullname, c.email, c.phone, c.mid,
         m.name AS membership_name, m.score
  FROM customers c
  JOIN memberships m ON m.mid = c.mid
`;

export async function createCustomer({ uid, fullname, email, phone }) {
  await pool.query(
    `INSERT INTO customers(uid, fullname, email, phone, mid)
     VALUES ($1, $2, $3, $4, 1)`,
    [uid, fullname, email, phone],
  );
  return getCustomer(uid);
}

export async function deleteCustomer(uid) {
  const result = await pool.query('DELETE FROM customers WHERE uid = $1', [uid]);
  return result.rowCount > 0;
}

export async function getCustomer(uid) {
  const result = await pool.query(`${selectCustomer} WHERE c.uid = $1`, [uid]);
  return result.rows[0] || null;
}

export async function updateCustomer(uid, input) {
  const values = [input.fullname || null, input.email || null, input.phone || null, uid];
  let sql = `UPDATE customers
    SET fullname = COALESCE($1, fullname),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        updated_at = NOW()`;
  if (input.hasMid) {
    values.splice(3, 0, input.mid);
    sql += ', mid = $4 WHERE uid = $5';
  } else {
    sql += ' WHERE uid = $4';
  }
  const result = await pool.query(sql, values);
  if (!result.rowCount) return null;
  return getCustomer(uid);
}

