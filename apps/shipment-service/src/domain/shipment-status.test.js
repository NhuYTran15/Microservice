import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTransition } from './shipment-status.js';

test('shipment follows allowed status transitions', () => {
  assert.doesNotThrow(() => validateTransition('PENDING', 'SHIPPING'));
  assert.doesNotThrow(() => validateTransition('SHIPPING', 'DELIVERED'));
  assert.throws(() => validateTransition('DELIVERED', 'SHIPPING'));
  assert.throws(() => validateTransition('PENDING', 'UNKNOWN'));
});

