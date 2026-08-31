import test from 'node:test';
import assert from 'node:assert/strict';
import { atPendingCap, MAX_PENDING_REQUESTS } from '../src/lib/swaps.js';

test('staff cannot open more than 3 pending swap or drop requests', () => {
  assert.equal(MAX_PENDING_REQUESTS, 3);
  assert.equal(atPendingCap(2), false);
  assert.equal(atPendingCap(3), true);
  assert.equal(atPendingCap(4), true);
});
