import { grpc, grpcError } from '@ecommerce/shared';

export function validateProduct(input) {
  if (!(input.pname || '').trim()) throw grpcError(grpc.status.INVALID_ARGUMENT, 'pname is required');
  if (!Number.isFinite(Number(input.price)) || Number(input.price) < 0) {
    throw grpcError(grpc.status.INVALID_ARGUMENT, 'price must be non-negative');
  }
  if (!Number.isInteger(Number(input.quantity)) || Number(input.quantity) < 0) {
    throw grpcError(grpc.status.INVALID_ARGUMENT, 'quantity must be a non-negative integer');
  }
  return { pname: input.pname.trim(), price: Number(input.price), quantity: Number(input.quantity) };
}

export function validateReservation(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw grpcError(grpc.status.INVALID_ARGUMENT, 'At least one item is required');
  }
  const ids = new Set();
  return items.map((item) => {
    const pid = Number(item.pid);
    const qty = Number(item.qty);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(qty) || qty <= 0) {
      throw grpcError(grpc.status.INVALID_ARGUMENT, 'pid and qty must be positive integers');
    }
    if (ids.has(pid)) throw grpcError(grpc.status.INVALID_ARGUMENT, `Duplicate product ${pid}`);
    ids.add(pid);
    return { pid, qty };
  });
}

