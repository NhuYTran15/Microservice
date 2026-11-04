import { randomUUID } from 'node:crypto';
import { createGrpcClient, grpc, grpcError, loadProto, unary } from '@ecommerce/shared';
import { discountForScore } from '../domain/discount-policy.js';
import { getOrder, listOrders, pool, saveOrder } from '../infrastructure/order-repository.js';

const customerProto = loadProto('customer.proto');
const productProto = loadProto('product.proto');
const customerClient = createGrpcClient(customerProto.CustomerService, process.env.CUSTOMER_GRPC_ADDRESS || 'customer-service:50052');
const productClient = createGrpcClient(productProto.ProductService, process.env.PRODUCT_GRPC_ADDRESS || 'product-service:50053');

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) throw grpcError(grpc.status.INVALID_ARGUMENT, 'At least one item is required');
  return items.map((item) => {
    const pid = Number(item.pid);
    const qty = Number(item.qty);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(qty) || qty <= 0) {
      throw grpcError(grpc.status.INVALID_ARGUMENT, 'pid and qty must be positive integers');
    }
    return { pid, qty };
  });
}

export const orderHandlers = {
  async CreateOrder(call, callback) {
    const reservationId = randomUUID();
    let reserved = false;
    try {
      const uid = Number(call.request.uid);
      if (!uid) throw grpcError(grpc.status.UNAUTHENTICATED, 'Invalid user');
      const requestedItems = validateItems(call.request.items);
      const membership = await unary(customerClient, 'GetMembership', { uid });
      const reservation = await unary(productClient, 'ReserveInventory', {
        reservation_id: reservationId,
        items: requestedItems,
      });
      reserved = true;
      const items = reservation.items;
      const subtotal = Number(items.reduce((sum, item) => sum + Number(item.unit_price) * item.qty, 0).toFixed(2));
      const discount = discountForScore(membership.score);
      const totalAmount = Number((subtotal * (1 - discount / 100)).toFixed(2));
      const order = await saveOrder({
        uid, discount, subtotal, totalAmount, reservationId, eventId: randomUUID(), items,
      });
      callback(null, order);
    } catch (error) {
      if (reserved) await unary(productClient, 'ReleaseInventory', { reservation_id: reservationId }).catch(() => {});
      callback(error);
    }
  },

  async ListOrders(call, callback) {
    try {
      const items = await listOrders(Number(call.request.uid), call.request.role === 'ADMIN');
      callback(null, { items });
    } catch (error) { callback(error); }
  },

  async GetOrder(call, callback) {
    try {
      const order = await getOrder(Number(call.request.oid));
      if (!order) throw grpcError(grpc.status.NOT_FOUND, 'Order not found');
      if (call.request.role !== 'ADMIN' && order.uid !== Number(call.request.uid)) {
        throw grpcError(grpc.status.PERMISSION_DENIED, 'You cannot access this order');
      }
      callback(null, order);
    } catch (error) { callback(error); }
  },

  async Health(_call, callback) {
    try {
      await pool.query('SELECT 1');
      callback(null, { status: 'UP', service: 'order-service' });
    } catch (error) { callback(grpcError(grpc.status.UNAVAILABLE, error.message)); }
  },
};

