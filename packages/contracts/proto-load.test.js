import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProto } from '@ecommerce/shared';

const contracts = [
  ['auth.proto', 'AuthService'],
  ['customer.proto', 'CustomerService'],
  ['product.proto', 'ProductService'],
  ['order.proto', 'OrderService'],
  ['shipment.proto', 'ShipmentService'],
];

test('all protobuf contracts load and expose their services', () => {
  for (const [file, service] of contracts) {
    const proto = loadProto(file);
    assert.ok(proto[service]?.service, `${file} must expose ${service}`);
  }
});

