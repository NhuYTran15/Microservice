import { createGrpcClient, loadProto } from '@ecommerce/shared';

const authProto = loadProto('auth.proto');
const customerProto = loadProto('customer.proto');
const productProto = loadProto('product.proto');
const orderProto = loadProto('order.proto');
const shipmentProto = loadProto('shipment.proto');

export const clients = {
  auth: createGrpcClient(authProto.AuthService, process.env.AUTH_GRPC_ADDRESS || 'auth-service:50051'),
  customer: createGrpcClient(customerProto.CustomerService, process.env.CUSTOMER_GRPC_ADDRESS || 'customer-service:50052'),
  product: createGrpcClient(productProto.ProductService, process.env.PRODUCT_GRPC_ADDRESS || 'product-service:50053'),
  order: createGrpcClient(orderProto.OrderService, process.env.ORDER_GRPC_ADDRESS || 'order-service:50054'),
  shipment: createGrpcClient(shipmentProto.ShipmentService, process.env.SHIPMENT_GRPC_ADDRESS || 'shipment-service:50055'),
};

