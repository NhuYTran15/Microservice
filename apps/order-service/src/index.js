import { grpc, loadProto, logger, startGrpcServer } from '@ecommerce/shared';
import { orderHandlers } from './application/order-handlers.js';
import { startOutboxPublisher } from './infrastructure/outbox-publisher.js';
import { pool } from './infrastructure/order-repository.js';

const proto = loadProto('order.proto');
const server = new grpc.Server();
server.addService(proto.OrderService.service, orderHandlers);

async function main() {
  await pool.query('SELECT 1');
  await startOutboxPublisher();
  await startGrpcServer(server, `0.0.0.0:${process.env.GRPC_PORT || 50054}`);
}

main().catch((error) => {
  logger.fatal({ error }, 'Order Service failed to start');
  process.exit(1);
});
