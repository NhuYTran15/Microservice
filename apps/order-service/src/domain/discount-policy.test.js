import assert from 'node:assert/strict';
import test from 'node:test';
import { discountForScore } from './discount-policy.js';

test('discount policy applies score boundaries', () => {
  assert.equal(discountForScore(0), 0);
  assert.equal(discountForScore(99), 0);
  assert.equal(discountForScore(100), 5);
  assert.equal(discountForScore(499), 5);
  assert.equal(discountForScore(500), 10);
  assert.equal(discountForScore(999), 10);
  assert.equal(discountForScore(1000), 15);
});

