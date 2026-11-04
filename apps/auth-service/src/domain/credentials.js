import { grpc, grpcError } from '@ecommerce/shared';

export function validateRegistration(input) {
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(input.username || '')) {
    throw grpcError(grpc.status.INVALID_ARGUMENT, 'Username must contain 3-50 valid characters');
  }
  if (!input.password || input.password.length < 8) {
    throw grpcError(grpc.status.INVALID_ARGUMENT, 'Password must contain at least 8 characters');
  }
  if (!/^\S+@\S+\.\S+$/.test(input.email || '')) {
    throw grpcError(grpc.status.INVALID_ARGUMENT, 'A valid email is required');
  }
  if (!(input.phone || '').trim()) throw grpcError(grpc.status.INVALID_ARGUMENT, 'phone is required');
  if (!(input.fullname || '').trim()) throw grpcError(grpc.status.INVALID_ARGUMENT, 'fullname is required');
}

