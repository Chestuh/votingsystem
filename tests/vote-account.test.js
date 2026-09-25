import test from 'node:test';
import assert from 'node:assert/strict';

import { hasAccountVoted, normalizeVoterAccount, recordVoterAccount } from '../api/vote.js';

test('normalizeVoterAccount trims and normalizes account identifiers', () => {
  assert.equal(normalizeVoterAccount('  Alice@Example.com  '), 'alice@example.com');
  assert.equal(normalizeVoterAccount(' user_42 '), 'user_42');
  assert.equal(normalizeVoterAccount(''), '');
});

test('vote tracking uses account names instead of browser tokens', () => {
  const state = { votedAccounts: ['alice@example.com'] };
  assert.equal(hasAccountVoted(state, 'Alice@Example.com'), true);
  assert.equal(hasAccountVoted(state, 'bob@example.com'), false);

  const updated = recordVoterAccount(state, 'bob@example.com');
  assert.deepEqual(updated.votedAccounts, ['alice@example.com', 'bob@example.com']);
});
