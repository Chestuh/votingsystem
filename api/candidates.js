import { getState, handleApiError, sendJson } from './_lib.js';

export default async function handler(request, response) {
  try {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return sendJson(response, 405, { error: 'Method not allowed.' });
    }
    const state = await getState();
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    return sendJson(response, 200, { candidates: state.candidates, pollEndsAt: state.pollEndsAt || null });
  } catch (error) {
    return handleApiError(response, error);
  }
}
