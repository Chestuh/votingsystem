import { getRedis, getState, handleApiError, requireAdmin, sendJson, stateKey } from '../_lib.js';

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      if (!requireAdmin(request, response)) return;
      const state = await getState();
      return sendJson(response, 200, { pollEndsAt: state.pollEndsAt || null });
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return sendJson(response, 405, { error: 'Method not allowed.' });
    }

    if (!requireAdmin(request, response)) return;
    const pollClosesAt = request.body?.pollClosesAt;
    if (!pollClosesAt) return sendJson(response, 400, { error: 'A poll close time is required.' });

    const closedAt = new Date(pollClosesAt);
    if (Number.isNaN(closedAt.getTime())) return sendJson(response, 400, { error: 'Invalid closing time.' });

    const state = await getState();
    state.pollEndsAt = closedAt.toISOString();
    await getRedis().set(stateKey, state);
    return sendJson(response, 200, { message: `The poll closes on ${closedAt.toLocaleString()}.` });
  } catch (error) {
    return handleApiError(response, error);
  }
}
