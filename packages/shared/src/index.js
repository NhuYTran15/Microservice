import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import pino from 'pino';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharedDir = path.dirname(fileURLToPath(import.meta.url));
const defaultProtoDir = path.resolve(sharedDir, '../../contracts/proto');

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
});

export function loadProto(fileName) {
  const protoPath = path.join(process.env.PROTO_DIR || defaultProtoDir, fileName);
  const definition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(definition).ecommerce;
}

export function grpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function startGrpcServer(server, address) {
  return new Promise((resolve, reject) => {
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (error, port) => {
      if (error) return reject(error);
      logger.info({ address, port }, 'gRPC server started');
      resolve(port);
    });
  });
}

export function createGrpcClient(Service, address) {
  return new Service(address, grpc.credentials.createInsecure());
}

export function unary(client, method, request, metadata) {
  return new Promise((resolve, reject) => {
    const callback = (error, response) => error ? reject(error) : resolve(response);
    if (metadata) client[method](request, metadata, callback);
    else client[method](request, callback);
  });
}

export async function retry(operation, {
  attempts = 30,
  delayMs = 2_000,
  description = 'Dependency',
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;

      logger.warn(
        { error, attempt, attempts, delayMs },
        `${description} unavailable; retrying`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export function required(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw grpcError(grpc.status.INVALID_ARGUMENT, `${field} is required`);
  }
  return value;
}

export { grpc };

