import bcrypt from 'bcryptjs';
import { grpc, loadProto, logger, startGrpcServer } from '@ecommerce/shared';
import { authHandlers } from './application/auth-handlers.js';
import { pool, seedAdmin } from './infrastructure/user-repository.js';

const proto = loadProto('auth.proto');
const server = new grpc.Server();
server.addService(proto.AuthService.service, authHandlers);

async function main() {
  await pool.query('SELECT 1');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  await seedAdmin(await bcrypt.hash(adminPassword, 12));
  await startGrpcServer(server, `0.0.0.0:${process.env.GRPC_PORT || 50051}`);
}

main().catch((error) => {
  logger.fatal({ error }, 'Auth Service failed to start');
  process.exit(1);
});
