import { grpc, loadProto, logger, startGrpcServer } from '@ecommerce/shared';
import { productHandlers } from './application/product-handlers.js';
import { connectProductDb } from './infrastructure/product-repository.js';

const proto = loadProto('product.proto');
const server = new grpc.Server();
server.addService(proto.ProductService.service, productHandlers);

async function main() {
  await connectProductDb();
  await startGrpcServer(server, `0.0.0.0:${process.env.GRPC_PORT || 50053}`);
}

main().catch((error) => {
  logger.fatal({ error }, 'Product Service failed to start');
  process.exit(1);
});
