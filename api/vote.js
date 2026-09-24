import { getRedis, getState, handleApiError, sendJson, stateKey } from './_lib.js';

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return sendJson(response, 405, { error: 'Method not allowed.' });
    }
    const payload = request.body;
    if (!payload?.candidateId || !payload?.voterToken) return sendJson(response, 400, { error: 'Candidate and voter token are required.' });
    const state = await getState();
    if (state.votedTokens.includes(payload.voterToken)) return sendJson(response, 409, { error: 'This browser has already voted.' });
    const candidate = state.candidates.find((item) => item.id === payload.candidateId);
    if (!candidate) return sendJson(response, 404, { error: 'Candidate not found.' });
    candidate.votes += 1;
    state.votedTokens.push(payload.voterToken);
    await getRedis().set(stateKey, state);
    return sendJson(response, 200, { message: 'Vote recorded.' });
  } catch (error) {
    return handleApiError(response, error);
  }
}
