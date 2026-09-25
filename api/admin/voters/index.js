import { getState, handleApiError, requireAdmin, sendJson } from '../../_lib.js';
import { normalizeVoterAccount } from '../../vote.js';

function getVoters(state) {
  const accounts = new Set([
    ...(Array.isArray(state.votedAccounts) ? state.votedAccounts : []),
    ...Object.keys(state.voterVotes || {}),
  ].map(normalizeVoterAccount).filter(Boolean));
  return [...accounts].map((account) => {
    const votes = state.voterVotes?.[account] || {};
    return { id: account, account, votes: Object.keys(votes).length };
  }).sort((first, second) => first.account.localeCompare(second.account));
}

export default async function handler(request, response) {
  try {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return sendJson(response, 405, { error: 'Method not allowed.' });
    }
    if (!requireAdmin(request, response)) return;
    const state = await getState();
    return sendJson(response, 200, { voters: getVoters(state) });
  } catch (error) {
    return handleApiError(response, error);
  }
}
