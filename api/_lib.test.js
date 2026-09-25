import test from 'node:test';
import assert from 'node:assert/strict';

import { getClientIp, hasVotedFromIp } from './_lib.js';

test('getClientIp prefers the first forwarded IP', () => {
  const request = {
    headers: {
      'x-forwarded-for': '203.0.113.7, 10.0.0.2',
      'x-real-ip': '10.0.0.2',
    },
  };

  assert.equal(getClientIp(request), '203.0.113.7');
});

test('hasVotedFromIp matches repeated IP addresses', () => {
  const state = { votedIPs: ['198.51.100.4'] };

  assert.equal(hasVotedFromIp(state, '198.51.100.4'), true);
  assert.equal(hasVotedFromIp(state, '198.51.100.5'), false);
});
