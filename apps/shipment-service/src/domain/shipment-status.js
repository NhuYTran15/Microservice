import { grpc, grpcError } from '@ecommerce/shared';

export const shipmentStatuses = ['PENDING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

const transitions = {
  PENDING: new Set(['SHIPPING', 'CANCELLED']),
  SHIPPING: new Set(['DELIVERED', 'CANCELLED']),
  DELIVERED: new Set(),
  CANCELLED: new Set(),
};

export function validateTransition(current, next) {
  if (!shipmentStatuses.includes(next)) {
    throw grpcError(grpc.status.INVALID_ARGUMENT, `Invalid shipment status: ${next}`);
  }
  if (current === next) return;
  if (!transitions[current]?.has(next)) {
    throw grpcError(grpc.status.FAILED_PRECONDITION, `Cannot change shipment from ${current} to ${next}`);
  }
}

