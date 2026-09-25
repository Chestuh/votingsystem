import { getRedis, getState, handleApiError, sendJson, stateKey } from './_lib.js';

export function normalizeVoterAccount(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function hasAccountVoted(state, voterAccount) {
  const normalizedAccount = normalizeVoterAccount(voterAccount);
  if (!normalizedAccount) return false;
  const legacyVotes = Array.isArray(state?.votedTokens) ? state.votedTokens : [];
  const accounts = Array.isArray(state?.votedAccounts) ? state.votedAccounts : legacyVotes;
  return accounts.some((account) => normalizeVoterAccount(account) === normalizedAccount);
}

export function recordVoterAccount(state, voterAccount) {
  const normalizedAccount = normalizeVoterAccount(voterAccount);
  if (!normalizedAccount) return state;
  const accounts = new Set([
    ...(Array.isArray(state?.votedAccounts) ? state.votedAccounts : []),
    ...(Array.isArray(state?.votedTokens) ? state.votedTokens : []),
  ].map((account) => normalizeVoterAccount(account)).filter(Boolean));
  accounts.add(normalizedAccount);
  state.votedAccounts = [...accounts];
  delete state.votedTokens;
  return state;
}

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return sendJson(response, 405, { error: 'Method not allowed.' });
    }
    const payload = request.body;
    const voterAccount = normalizeVoterAccount(payload?.voterAccount || payload?.account || payload?.voterToken);
    if (!payload?.candidateId || !voterAccount) return sendJson(response, 400, { error: 'Candidate and voter account are required.' });
    const state = await getState();
    if (hasAccountVoted(state, voterAccount)) return sendJson(response, 409, { error: 'This account has already voted.' });
    const candidate = state.candidates.find((item) => item.id === payload.candidateId);
    if (!candidate) return sendJson(response, 404, { error: 'Candidate not found.' });
    candidate.votes += 1;
    recordVoterAccount(state, voterAccount);
    await getRedis().set(stateKey, state);
    return sendJson(response, 200, { message: 'Vote recorded.' });
  } catch (error) {
    return handleApiError(response, error);
  }
}
