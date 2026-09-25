import test from 'node:test';
import assert from 'node:assert/strict';

import { hasAccountVoted, normalizeVoterAccount, recordVoterAccount } from '../api/vote.js';

test('normalizeVoterAccount trims and normalizes IGN#TAG account identifiers', () => {
  assert.equal(normalizeVoterAccount('  chizu#0328  '), 'CHIZU#0328');
  assert.equal(normalizeVoterAccount('  ryu#9999 '), 'RYU#9999');
  assert.equal(normalizeVoterAccount(''), '');
});

test('vote tracking uses accounts instead of browser tokens', () => {
  const state = { votedAccounts: ['CHIZU#0328'] };
  assert.equal(hasAccountVoted(state, 'chizu#0328'), true);
  assert.equal(hasAccountVoted(state, 'zed#9999'), false);

  const updated = recordVoterAccount(state, 'zed#9999');
  assert.deepEqual(updated.votedAccounts, ['CHIZU#0328', 'ZED#9999']);
});
