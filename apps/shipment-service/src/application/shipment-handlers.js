import { grpc, grpcError } from '@ecommerce/shared';
import { validateTransition } from '../domain/shipment-status.js';
import { getShipment, getShipmentByOrder, pingShipmentDb, updateShipmentStatus } from '../infrastructure/shipment-repository.js';

function normalize(shipment) {
  return {
    shipid: shipment.shipid,
    oid: shipment.oid,
    uid: shipment.uid,
    status: shipment.status,
    created_at: shipment.created_at.toISOString(),
    updated_at: shipment.updated_at.toISOString(),
  };
}

export const shipmentHandlers = {
  async GetShipment(call, callback) {
    try {
      const shipment = await getShipment(Number(call.request.shipid));
      if (!shipment) throw grpcError(grpc.status.NOT_FOUND, 'Shipment not found');
      const privileged = ['ADMIN', 'SHIPMENT_STAFF'].includes(call.request.role);
      if (!privileged && shipment.uid !== Number(call.request.uid)) {
        throw grpcError(grpc.status.PERMISSION_DENIED, 'You cannot access this shipment');
      }
      callback(null, normalize(shipment));
    } catch (error) { callback(error); }
  },

  async GetShipmentByOrder(call, callback) {
    try {
      const shipment = await getShipmentByOrder(Number(call.request.oid));
      if (!shipment) throw grpcError(grpc.status.NOT_FOUND, 'Shipment is not available yet');
      const privileged = ['ADMIN', 'SHIPMENT_STAFF'].includes(call.request.role);
      if (!privileged && shipment.uid !== Number(call.request.uid)) {
        throw grpcError(grpc.status.PERMISSION_DENIED, 'You cannot access this shipment');
      }
      callback(null, normalize(shipment));
    } catch (error) { callback(error); }
  },

  async UpdateStatus(call, callback) {
    try {
      const current = await getShipment(Number(call.request.shipid));
      if (!current) throw grpcError(grpc.status.NOT_FOUND, 'Shipment not found');
      validateTransition(current.status, call.request.status);
      const updated = current.status === call.request.status
        ? current
        : await updateShipmentStatus(current.shipid, call.request.status);
      callback(null, normalize(updated));
    } catch (error) { callback(error); }
  },

  async Health(_call, callback) {
    try {
      await pingShipmentDb();
      callback(null, { status: 'UP', service: 'shipment-service' });
    } catch (error) { callback(grpcError(grpc.status.UNAVAILABLE, error.message)); }
  },
};

