import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createClient } from 'redis';
import { logger, unary } from '@ecommerce/shared';
import { clients } from './infrastructure/grpc-clients.js';
import { authenticate, authorize, ownCustomerOrAdmin } from './middleware/auth.js';
import { cacheResponse, clearProductCache } from './middleware/cache.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './application/error-mapper.js';

const app = express();
const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redis.on('error', (error) => logger.error({ error }, 'Redis error'));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({
  logger,
  redact: ['req.headers.authorization'],
  genReqId: (req, res) => {
    const id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
}));

app.post('/api/auth/register', createRateLimiter(redis), asyncRoute(async (req, res) => {
  const result = await unary(clients.auth, 'Register', {
    username: req.body.username,
    password: req.body.password,
    email: req.body.email,
    phone: req.body.phone,
    fullname: req.body.fullname,
  });
  res.status(201).json(result);
}));

app.post('/api/auth/login', createRateLimiter(redis), asyncRoute(async (req, res) => {
  const result = await unary(clients.auth, 'Login', req.body);
  res.json({ accessToken: result.access_token, tokenType: result.token_type, expiresIn: result.expires_in });
}));

app.get('/api/health', asyncRoute(async (_req, res) => {
  const checks = await Promise.allSettled([
    redis.ping(),
    unary(clients.auth, 'Health', {}),
    unary(clients.customer, 'Health', {}),
    unary(clients.product, 'Health', {}),
    unary(clients.order, 'Health', {}),
    unary(clients.shipment, 'Health', {}),
  ]);
  const names = ['redis', 'auth', 'customer', 'product', 'order', 'shipment'];
  const dependencies = Object.fromEntries(checks.map((check, index) => [names[index], check.status === 'fulfilled' ? 'UP' : 'DOWN']));
  const up = checks.every((check) => check.status === 'fulfilled');
  res.status(up ? 200 : 503).json({ status: up ? 'UP' : 'DEGRADED', message: 'E-commerce API health', dependencies });
}));

app.use('/api', createRateLimiter(redis));

app.get('/api/customers/:uid', authenticate, ownCustomerOrAdmin, asyncRoute(async (req, res) => {
  res.json(await unary(clients.customer, 'GetCustomer', { uid: Number(req.params.uid) }));
}));

app.put('/api/customers/:uid', authenticate, ownCustomerOrAdmin, asyncRoute(async (req, res) => {
  const hasMid = Object.hasOwn(req.body, 'mid');
  const result = await unary(clients.customer, 'UpdateCustomer', {
    uid: Number(req.params.uid),
    actor_role: req.user.role,
    fullname: req.body.fullname,
    email: req.body.email,
    phone: req.body.phone,
    mid: req.body.mid,
    has_mid: hasMid,
  });
  res.json(result);
}));

app.get('/api/products', authenticate, cacheResponse(redis), asyncRoute(async (req, res) => {
  res.json(await unary(clients.product, 'ListProducts', {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  }));
}));

app.get('/api/products/:pid', authenticate, cacheResponse(redis), asyncRoute(async (req, res) => {
  res.json(await unary(clients.product, 'GetProduct', { pid: Number(req.params.pid) }));
}));

app.post('/api/products', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => {
  const result = await unary(clients.product, 'CreateProduct', req.body);
  await clearProductCache(redis);
  res.status(201).json(result);
}));

app.put('/api/products/:pid', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => {
  const result = await unary(clients.product, 'UpdateProduct', { pid: Number(req.params.pid), ...req.body });
  await clearProductCache(redis);
  res.json(result);
}));

app.delete('/api/products/:pid', authenticate, authorize('ADMIN'), asyncRoute(async (req, res) => {
  const result = await unary(clients.product, 'DeleteProduct', { pid: Number(req.params.pid) });
  await clearProductCache(redis);
  res.json({ ...result, pid: Number(req.params.pid) });
}));

app.post('/api/orders', authenticate, authorize('CUSTOMER', 'ADMIN'), asyncRoute(async (req, res) => {
  const result = await unary(clients.order, 'CreateOrder', {
    uid: req.user.uid,
    role: req.user.role,
    items: req.body.items,
  });
  await clearProductCache(redis);
  res.status(201).json(result);
}));

app.get('/api/orders', authenticate, asyncRoute(async (req, res) => {
  res.json(await unary(clients.order, 'ListOrders', req.user));
}));

app.get('/api/orders/:oid', authenticate, asyncRoute(async (req, res) => {
  res.json(await unary(clients.order, 'GetOrder', { oid: Number(req.params.oid), ...req.user }));
}));

app.get('/api/orders/:oid/shipment', authenticate, asyncRoute(async (req, res) => {
  res.json(await unary(clients.shipment, 'GetShipmentByOrder', { oid: Number(req.params.oid), ...req.user }));
}));

app.get('/api/shipments/:shipid', authenticate, asyncRoute(async (req, res) => {
  res.json(await unary(clients.shipment, 'GetShipment', { shipid: Number(req.params.shipid), ...req.user }));
}));

app.patch('/api/shipments/:shipid/status', authenticate, authorize('ADMIN', 'SHIPMENT_STAFF'), asyncRoute(async (req, res) => {
  res.json(await unary(clients.shipment, 'UpdateStatus', {
    shipid: Number(req.params.shipid),
    status: req.body.status,
  }));
}));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

async function main() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  await redis.connect();
  const port = Number(process.env.GATEWAY_PORT || 3000);
  app.listen(port, () => logger.info({ port }, 'API Gateway started'));
}

main().catch((error) => {
  logger.fatal({ error }, 'API Gateway failed to start');
  process.exit(1);
});
