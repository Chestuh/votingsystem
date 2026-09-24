import { colors, getState, positions, randomUUID, redis, requireAdmin, sendJson, stateKey } from '../../../_lib.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  if (!requireAdmin(request, response)) return;
  const payload = request.body;
  if (!payload?.name?.trim() || !payload?.bio?.trim() || !positions.includes(payload.position)) return sendJson(response, 400, { error: 'Name, position, and bio are required.' });
  const state = await getState();
  const candidate = { id: `candidate-${randomUUID().slice(0, 12)}`, name: payload.name.trim(), position: payload.position, bio: payload.bio.trim(), votes: 0, color: colors[state.candidates.length % colors.length] };
  state.candidates.push(candidate);
  await redis.set(stateKey, state);
  return sendJson(response, 201, { message: `${candidate.name} was added under ${candidate.position}.` });
}
