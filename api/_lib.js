import { Redis } from '@upstash/redis';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

let redisClient;
export const stateKey = 'voiceboard:state';
export const positions = ['Captain', 'Vice-Captain', 'Secretary', 'Guidance Officers', 'Leiutenants'];
export const colors = ['maya', 'jonah', 'alina', 'sam'];
export const defaultState = {
  candidates: [
    { id: 'maya', name: 'Maya Chen', position: 'Captain', bio: 'Product designer - Austin', votes: 488, color: 'maya' },
    { id: 'jonah', name: 'Jonah Reed', position: 'Vice-Captain', bio: 'Documentary maker - Detroit', votes: 402, color: 'jonah' },
    { id: 'alina', name: 'Alina Petrov', position: 'Secretary', bio: 'Creative technologist - Lisbon', votes: 244, color: 'alina' },
    { id: 'sam', name: 'Sam Williams', position: 'Guidance Officers', bio: 'Community builder - Oakland', votes: 150, color: 'sam' },
  ],
  votedAccounts: [],
  voterVotes: {},
  pollEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Vercel Redis is not configured. Connect Redis and add UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.');
  }
  if (!redisClient) redisClient = new Redis({ url, token });
  return redisClient;
}

export function handleApiError(response, error) {
  const message = error instanceof Error ? error.message : 'The API could not complete the request.';
  const status = message.includes('Redis is not configured') ? 503 : 500;
  sendJson(response, status, { error: message });
}

export function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

export function readBody(request) {
  if (!request.body) return null;
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch { return null; }
  }
  return request.body;
}

export async function getState() {
  const redis = getRedis();
  const state = await redis.get(stateKey);
  if (state) return state;
  await redis.set(stateKey, defaultState);
  return structuredClone(defaultState);
}

export function adminCredentials() {
  return {
    username: process.env.VOICEBOARD_ADMIN_USER,
    password: process.env.VOICEBOARD_ADMIN_PASSWORD,
  };
}

function sessionSecret() {
  return process.env.VOICEBOARD_SESSION_SECRET || adminCredentials().password || 'configure-a-session-secret';
}

function sign(value) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function createSession() {
  const payload = `${Date.now() + 8 * 60 * 60 * 1000}.${randomUUID()}`;
  return `${payload}.${sign(payload)}`;
}

export function sessionCookie(request) {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith('voiceboard_session='));
  if (!cookie) return null;
  const token = decodeURIComponent(cookie.slice('voiceboard_session='.length));
  const pieces = token.split('.');
  if (pieces.length < 3 || Number(pieces[0]) < Date.now()) return null;
  const signature = pieces.pop();
  const payload = pieces.join('.');
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? token : null;
}

export function cookieHeader(request, token) {
  const secure = request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `voiceboard_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`;
}

export function requireAdmin(request, response) {
  if (sessionCookie(request)) return true;
  sendJson(response, 401, { error: 'Admin sign-in required.' });
  return false;
}

export { randomUUID };
