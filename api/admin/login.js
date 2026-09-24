import { adminCredentials, cookieHeader, createSession, readBody, sendJson } from '../../_lib.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }
  const payload = readBody(request);
  const credentials = adminCredentials();
  if (!credentials.username || !credentials.password || payload?.username !== credentials.username || payload?.password !== credentials.password) {
    return sendJson(response, 401, { error: 'Invalid administrator credentials.' });
  }
  response.setHeader('Set-Cookie', cookieHeader(request, createSession()));
  return sendJson(response, 200, { message: 'Signed in.' });
}
