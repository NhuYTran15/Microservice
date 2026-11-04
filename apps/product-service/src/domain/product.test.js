import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProduct, validateReservation } from './product.js';

test('product validation accepts valid values', () => {
  assert.deepEqual(validateProduct({ pname: 'Mouse', price: 25, quantity: 10 }), {
    pname: 'Mouse', price: 25, quantity: 10,
  });
});

test('reservation rejects duplicate products and invalid quantity', () => {
  assert.throws(() => validateReservation([{ pid: 1, qty: 1 }, { pid: 1, qty: 2 }]));
  assert.throws(() => validateReservation([{ pid: 1, qty: 0 }]));
});
