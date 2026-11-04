import { grpc, loadProto, logger, startGrpcServer } from '@ecommerce/shared';
import { shipmentHandlers } from './application/shipment-handlers.js';
import { startOrderCreatedConsumer } from './infrastructure/order-created-consumer.js';
import { connectShipmentDb } from './infrastructure/shipment-repository.js';

const proto = loadProto('shipment.proto');
const server = new grpc.Server();
server.addService(proto.ShipmentService.service, shipmentHandlers);

async function main() {
  await connectShipmentDb();
  await startOrderCreatedConsumer();
  await startGrpcServer(server, `0.0.0.0:${process.env.GRPC_PORT || 50055}`);
}

main().catch((error) => {
  logger.fatal({ error }, 'Shipment Service failed to start');
  process.exit(1);
});
