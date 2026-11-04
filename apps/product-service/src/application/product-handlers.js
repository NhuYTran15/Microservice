import { grpc, grpcError } from '@ecommerce/shared';
import { validateProduct, validateReservation } from '../domain/product.js';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  pingProductDb,
  releaseInventory,
  reserveInventory,
  updateProduct,
} from '../infrastructure/product-repository.js';

export const productHandlers = {
  async ListProducts(call, callback) {
    try {
      const page = Math.max(1, Number(call.request.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(call.request.limit) || 20));
      const result = await listProducts(page, limit);
      callback(null, { ...result, page, limit });
    } catch (error) { callback(error); }
  },

  async GetProduct(call, callback) {
    try {
      const product = await getProduct(Number(call.request.pid));
      if (!product) throw grpcError(grpc.status.NOT_FOUND, 'Product not found');
      callback(null, product);
    } catch (error) { callback(error); }
  },

  async CreateProduct(call, callback) {
    try { callback(null, await createProduct(validateProduct(call.request))); }
    catch (error) { callback(error); }
  },

  async UpdateProduct(call, callback) {
    try {
      const product = await updateProduct(Number(call.request.pid), validateProduct(call.request));
      if (!product) throw grpcError(grpc.status.NOT_FOUND, 'Product not found');
      callback(null, product);
    } catch (error) { callback(error); }
  },

  async DeleteProduct(call, callback) {
    try {
      const deleted = await deleteProduct(Number(call.request.pid));
      if (!deleted) throw grpcError(grpc.status.NOT_FOUND, 'Product not found');
      callback(null, { success: true, message: 'Product deleted successfully' });
    } catch (error) { callback(error); }
  },

  async ReserveInventory(call, callback) {
    try {
      const reservationId = call.request.reservation_id;
      if (!reservationId) throw grpcError(grpc.status.INVALID_ARGUMENT, 'reservation_id is required');
      const items = await reserveInventory(reservationId, validateReservation(call.request.items));
      callback(null, { reservation_id: reservationId, items });
    } catch (error) {
      if (error.reason === 'INSUFFICIENT_STOCK') return callback(grpcError(grpc.status.ALREADY_EXISTS, error.message));
      if (error.reason === 'NOT_FOUND') return callback(grpcError(grpc.status.NOT_FOUND, error.message));
      callback(error);
    }
  },

  async ReleaseInventory(call, callback) {
    try {
      const released = await releaseInventory(call.request.reservation_id);
      callback(null, { success: released, message: released ? 'Inventory released' : 'Reservation is not active' });
    } catch (error) { callback(error); }
  },

  async Health(_call, callback) {
    try {
      await pingProductDb();
      callback(null, { status: 'UP', service: 'product-service' });
    } catch (error) { callback(grpcError(grpc.status.UNAVAILABLE, error.message)); }
  },
};

