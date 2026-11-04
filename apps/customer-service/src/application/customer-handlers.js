import { grpc, grpcError, required } from '@ecommerce/shared';
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  pool,
  updateCustomer,
} from '../infrastructure/customer-repository.js';

function normalize(row) {
  return {
    uid: row.uid,
    fullname: row.fullname,
    email: row.email,
    phone: row.phone,
    mid: row.mid,
    membership_name: row.membership_name,
    score: row.score,
  };
}

function handleError(error, callback) {
  if (error.code === '23505') return callback(grpcError(grpc.status.ALREADY_EXISTS, 'Email already exists'));
  if (error.code === '23503') return callback(grpcError(grpc.status.INVALID_ARGUMENT, 'Membership does not exist'));
  callback(error);
}

export const customerHandlers = {
  async CreateCustomer(call, callback) {
    try {
      const uid = Number(call.request.uid);
      if (!uid) throw grpcError(grpc.status.INVALID_ARGUMENT, 'uid is required');
      required(call.request.fullname, 'fullname');
      required(call.request.email, 'email');
      required(call.request.phone, 'phone');
      const customer = await createCustomer({ ...call.request, uid });
      callback(null, normalize(customer));
    } catch (error) { handleError(error, callback); }
  },

  async DeleteCustomer(call, callback) {
    try {
      const deleted = await deleteCustomer(Number(call.request.uid));
      callback(null, { success: deleted, message: deleted ? 'Customer deleted' : 'Customer not found' });
    } catch (error) { callback(error); }
  },

  async GetCustomer(call, callback) {
    try {
      const customer = await getCustomer(Number(call.request.uid));
      if (!customer) throw grpcError(grpc.status.NOT_FOUND, 'Customer not found');
      callback(null, normalize(customer));
    } catch (error) { callback(error); }
  },

  async UpdateCustomer(call, callback) {
    try {
      const request = call.request;
      if (request.has_mid && request.actor_role !== 'ADMIN') {
        throw grpcError(grpc.status.PERMISSION_DENIED, 'Only admin can change membership');
      }
      const customer = await updateCustomer(Number(request.uid), {
        fullname: request.fullname,
        email: request.email,
        phone: request.phone,
        hasMid: request.has_mid,
        mid: Number(request.mid),
      });
      if (!customer) throw grpcError(grpc.status.NOT_FOUND, 'Customer not found');
      callback(null, normalize(customer));
    } catch (error) { handleError(error, callback); }
  },

  async GetMembership(call, callback) {
    try {
      const customer = await getCustomer(Number(call.request.uid));
      if (!customer) throw grpcError(grpc.status.NOT_FOUND, 'Customer not found');
      callback(null, { mid: customer.mid, name: customer.membership_name, score: customer.score });
    } catch (error) { callback(error); }
  },

  async Health(_call, callback) {
    try {
      await pool.query('SELECT 1');
      callback(null, { status: 'UP', service: 'customer-service' });
    } catch (error) { callback(grpcError(grpc.status.UNAVAILABLE, error.message)); }
  },
};

