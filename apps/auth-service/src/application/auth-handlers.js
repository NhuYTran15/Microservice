import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createGrpcClient, grpc, grpcError, loadProto, unary } from '@ecommerce/shared';
import { validateRegistration } from '../domain/credentials.js';
import { createUser, findByUsername, pool } from '../infrastructure/user-repository.js';

const customerProto = loadProto('customer.proto');
const customerClient = createGrpcClient(
  customerProto.CustomerService,
  process.env.CUSTOMER_GRPC_ADDRESS || 'customer-service:50052',
);

function authError(error, callback) {
  if (error.code === '23505') return callback(grpcError(grpc.status.ALREADY_EXISTS, 'Username already exists'));
  callback(error);
}

export const authHandlers = {
  async Register(call, callback) {
    const client = await pool.connect();
    let customerCreated = false;
    let uid;
    try {
      validateRegistration(call.request);
      await client.query('BEGIN');
      const passwordHash = await bcrypt.hash(call.request.password, 12);
      const user = await createUser(client, {
        username: call.request.username.trim(),
        passwordHash,
      });
      uid = user.uid;
      await unary(customerClient, 'CreateCustomer', {
        uid,
        fullname: call.request.fullname.trim(),
        email: call.request.email.trim().toLowerCase(),
        phone: call.request.phone.trim(),
      });
      customerCreated = true;
      await client.query('COMMIT');
      callback(null, { uid, message: 'User registered successfully' });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (customerCreated && uid) {
        await unary(customerClient, 'DeleteCustomer', { uid }).catch(() => {});
      }
      authError(error, callback);
    } finally {
      client.release();
    }
  },

  async Login(call, callback) {
    try {
      const { username, password } = call.request;
      if (!username || !password) throw grpcError(grpc.status.INVALID_ARGUMENT, 'Username and password are required');
      const user = await findByUsername(username);
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        throw grpcError(grpc.status.UNAUTHENTICATED, 'Invalid username or password');
      }
      const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
      const accessToken = jwt.sign(
        { role: user.role_name },
        process.env.JWT_SECRET,
        { subject: String(user.uid), expiresIn },
      );
      callback(null, { access_token: accessToken, token_type: 'Bearer', expires_in: 3600 });
    } catch (error) { callback(error); }
  },

  async Health(_call, callback) {
    try {
      await pool.query('SELECT 1');
      callback(null, { status: 'UP', service: 'auth-service' });
    } catch (error) { callback(grpcError(grpc.status.UNAVAILABLE, error.message)); }
  },
};

