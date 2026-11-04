import { grpc } from '@ecommerce/shared';

const statusMap = new Map([
  [grpc.status.INVALID_ARGUMENT, 400],
  [grpc.status.UNAUTHENTICATED, 401],
  [grpc.status.PERMISSION_DENIED, 403],
  [grpc.status.NOT_FOUND, 404],
  [grpc.status.ALREADY_EXISTS, 409],
  [grpc.status.FAILED_PRECONDITION, 409],
  [grpc.status.UNAVAILABLE, 503],
  [grpc.status.DEADLINE_EXCEEDED, 504],
]);

export function errorHandler(error, req, res, _next) {
  const status = statusMap.get(error.code) || error.status || 500;
  if (status >= 500) req.log.error({ err: error }, 'Request failed');
  else req.log.warn({ err: error, status }, 'Request rejected');
  const message = error.details || error.message || 'Internal server error';
  res.status(status).json({ error: message });
}

