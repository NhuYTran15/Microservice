import { grpc, loadProto, logger, retry, startGrpcServer } from '@ecommerce/shared';
import { customerHandlers } from './application/customer-handlers.js';
import { pool } from './infrastructure/customer-repository.js';

const proto = loadProto('customer.proto');
const server = new grpc.Server();
server.addService(proto.CustomerService.service, customerHandlers);

async function main() {
  await retry(() => pool.query('SELECT 1'), {
    description: 'Customer database',
  });
  await startGrpcServer(server, `0.0.0.0:${process.env.GRPC_PORT || 50052}`);
}

main().catch((error) => {
  logger.fatal({ error }, 'Customer Service failed to start');
  process.exit(1);
});

