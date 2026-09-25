import { getRedis, getState, handleApiError, sendJson, stateKey } from './_lib.js';

export function normalizeVoterAccount(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export function hasAccountVoted(state, voterAccount, position) {
  const normalizedAccount = normalizeVoterAccount(voterAccount);
  if (!normalizedAccount) return false;
  const voterVotes = state?.voterVotes?.[normalizedAccount];
  if (voterVotes) return position ? Boolean(voterVotes[position]) : Object.keys(voterVotes).length > 0;
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

export function recordVote(state, voterAccount, position, candidateId) {
  const normalizedAccount = normalizeVoterAccount(voterAccount);
  if (!normalizedAccount || !position || !candidateId) return state;
  if (!state.voterVotes || typeof state.voterVotes !== 'object' || Array.isArray(state.voterVotes)) state.voterVotes = {};
  if (!state.voterVotes[normalizedAccount]) state.voterVotes[normalizedAccount] = {};
  state.voterVotes[normalizedAccount][position] = candidateId;
  recordVoterAccount(state, normalizedAccount);
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
    const candidate = state.candidates.find((item) => item.id === payload.candidateId);
    if (!candidate) return sendJson(response, 404, { error: 'Candidate not found.' });
    if (hasAccountVoted(state, voterAccount, candidate.position)) return sendJson(response, 409, { error: `This account has already voted for ${candidate.position}.` });
    candidate.votes += 1;
    recordVote(state, voterAccount, candidate.position, candidate.id);
    await getRedis().set(stateKey, state);
    return sendJson(response, 200, { message: 'Vote recorded.' });
  } catch (error) {
    return handleApiError(response, error);
  }
}
