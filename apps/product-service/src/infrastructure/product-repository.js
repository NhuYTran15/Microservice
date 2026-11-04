import { MongoClient } from 'mongodb';

export const mongoClient = new MongoClient(process.env.PRODUCT_MONGODB_URL);
let db;

export async function connectProductDb() {
  await mongoClient.connect();
  db = mongoClient.db();
  await db.collection('products').createIndex({ pid: 1 }, { unique: true });
  await db.collection('reservations').createIndex({ reservation_id: 1 }, { unique: true });
  if (await db.collection('products').countDocuments() === 0) {
    await db.collection('products').insertMany([
      { pid: 1, pname: 'Laptop', price: 1500, quantity: 10 },
      { pid: 2, pname: 'Mouse', price: 25, quantity: 100 },
      { pid: 3, pname: 'Keyboard', price: 75, quantity: 50 },
    ]);
    await db.collection('counters').updateOne(
      { _id: 'product' },
      { $set: { value: 3 } },
      { upsert: true },
    );
  }
}

async function nextProductId() {
  const counter = await db.collection('counters').findOneAndUpdate(
    { _id: 'product' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return counter.value;
}

export async function listProducts(page, limit) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    db.collection('products').find({}, { projection: { _id: 0 } }).sort({ pid: 1 }).skip(skip).limit(limit).toArray(),
    db.collection('products').countDocuments(),
  ]);
  return { items, total };
}

export async function getProduct(pid) {
  return db.collection('products').findOne({ pid }, { projection: { _id: 0 } });
}

export async function createProduct(input) {
  const product = { pid: await nextProductId(), ...input };
  await db.collection('products').insertOne(product);
  return product;
}

export async function updateProduct(pid, input) {
  return db.collection('products').findOneAndUpdate(
    { pid },
    { $set: input },
    { returnDocument: 'after', projection: { _id: 0 } },
  );
}

export async function deleteProduct(pid) {
  return (await db.collection('products').deleteOne({ pid })).deletedCount > 0;
}

export async function reserveInventory(reservationId, items) {
  const previous = await db.collection('reservations').findOne({ reservation_id: reservationId });
  if (previous?.status === 'ACTIVE') return previous.items;

  const reserved = [];
  try {
    for (const item of items) {
      const product = await db.collection('products').findOneAndUpdate(
        { pid: item.pid, quantity: { $gte: item.qty } },
        { $inc: { quantity: -item.qty } },
        { returnDocument: 'before', projection: { _id: 0 } },
      );
      if (!product) {
        const exists = await db.collection('products').findOne({ pid: item.pid });
        const error = new Error(exists ? `Insufficient stock for product ${item.pid}` : `Product ${item.pid} not found`);
        error.reason = exists ? 'INSUFFICIENT_STOCK' : 'NOT_FOUND';
        throw error;
      }
      reserved.push({ pid: item.pid, qty: item.qty, pname: product.pname, unit_price: product.price });
    }
    await db.collection('reservations').insertOne({
      reservation_id: reservationId,
      status: 'ACTIVE',
      items: reserved,
      created_at: new Date(),
    });
    return reserved;
  } catch (error) {
    await Promise.all(reserved.map((item) =>
      db.collection('products').updateOne({ pid: item.pid }, { $inc: { quantity: item.qty } })
    ));
    throw error;
  }
}

export async function releaseInventory(reservationId) {
  const reservation = await db.collection('reservations').findOneAndUpdate(
    { reservation_id: reservationId, status: 'ACTIVE' },
    { $set: { status: 'RELEASING' } },
    { returnDocument: 'before' },
  );
  if (!reservation) return false;
  await Promise.all(reservation.items.map((item) =>
    db.collection('products').updateOne({ pid: item.pid }, { $inc: { quantity: item.qty } })
  ));
  await db.collection('reservations').updateOne(
    { reservation_id: reservationId },
    { $set: { status: 'RELEASED', released_at: new Date() } },
  );
  return true;
}

export async function pingProductDb() {
  await db.command({ ping: 1 });
}

