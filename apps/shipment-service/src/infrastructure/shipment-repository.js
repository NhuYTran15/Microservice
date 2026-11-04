import { MongoClient } from 'mongodb';

export const mongoClient = new MongoClient(process.env.SHIPMENT_MONGODB_URL);
let db;

export async function connectShipmentDb() {
  await mongoClient.connect();
  db = mongoClient.db();
  await db.collection('shipments').createIndex({ shipid: 1 }, { unique: true });
  await db.collection('shipments').createIndex({ oid: 1 }, { unique: true });
  await db.collection('processed_events').createIndex({ event_id: 1 }, { unique: true });
  await db.collection('failed_events').createIndex({ event_id: 1 }, { unique: true, sparse: true });
}

async function nextShipmentId() {
  const counter = await db.collection('counters').findOneAndUpdate(
    { _id: 'shipment' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return counter.value;
}

export async function processOrderCreated(event) {
  if (!event?.event_id || !event?.data?.oid || !event?.data?.uid) {
    await db.collection('failed_events').updateOne(
      { event_id: event?.event_id || `invalid-${Date.now()}` },
      { $setOnInsert: { event, reason: 'Missing event_id, oid, or uid', received_at: new Date() } },
      { upsert: true },
    );
    return { failed: true };
  }
  if (await db.collection('processed_events').findOne({ event_id: event.event_id })) {
    return { duplicate: true };
  }
  let shipment = await db.collection('shipments').findOne({ oid: Number(event.data.oid) });
  if (!shipment) {
    const now = new Date();
    const candidate = {
      shipid: await nextShipmentId(),
      oid: Number(event.data.oid),
      uid: Number(event.data.uid),
      status: 'PENDING',
      created_at: now,
      updated_at: now,
    };
    try {
      await db.collection('shipments').insertOne(candidate);
      shipment = candidate;
    } catch (error) {
      if (error.code !== 11000) throw error;
      shipment = await db.collection('shipments').findOne({ oid: Number(event.data.oid) });
    }
  }
  await db.collection('processed_events').updateOne(
    { event_id: event.event_id },
    { $setOnInsert: { event_id: event.event_id, oid: event.data.oid, processed_at: new Date() } },
    { upsert: true },
  );
  return shipment;
}

export async function getShipment(shipid) {
  return db.collection('shipments').findOne({ shipid }, { projection: { _id: 0 } });
}

export async function getShipmentByOrder(oid) {
  return db.collection('shipments').findOne({ oid }, { projection: { _id: 0 } });
}

export async function updateShipmentStatus(shipid, status) {
  return db.collection('shipments').findOneAndUpdate(
    { shipid },
    { $set: { status, updated_at: new Date() } },
    { returnDocument: 'after', projection: { _id: 0 } },
  );
}

export async function pingShipmentDb() {
  await db.command({ ping: 1 });
}

