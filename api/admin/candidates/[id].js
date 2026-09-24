import { getRedis, getState, handleApiError, requireAdmin, sendJson, stateKey } from '../../_lib.js';

export default async function handler(request, response) {
  try {
    if (request.method !== 'DELETE') {
      response.setHeader('Allow', 'DELETE');
      return sendJson(response, 405, { error: 'Method not allowed.' });
    }
    if (!requireAdmin(request, response)) return;
    const state = await getState();
    const candidate = state.candidates.find((item) => item.id === request.query.id);
    if (!candidate) return sendJson(response, 404, { error: 'Candidate not found.' });
    state.candidates = state.candidates.filter((item) => item.id !== candidate.id);
    await getRedis().set(stateKey, state);
    return sendJson(response, 200, { message: `${candidate.name} was removed from the ballot.` });
  } catch (error) {
    return handleApiError(response, error);
  }
}
