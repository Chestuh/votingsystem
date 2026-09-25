import { getRedis, getState, handleApiError, requireAdmin, sendJson, stateKey } from '../../_lib.js';
import { normalizeVoterAccount } from '../../vote.js';

export default async function handler(request, response) {
	try {
		if (request.method !== 'DELETE') {
			response.setHeader('Allow', 'DELETE');
			return sendJson(response, 405, { error: 'Method not allowed.' });
		}
		if (!requireAdmin(request, response)) return;
		const account = normalizeVoterAccount(request.query.id);
		const state = await getState();
		const voterVotes = state.voterVotes?.[account] || {};
		const hasLegacyRecord = (state.votedAccounts || []).some((item) => normalizeVoterAccount(item) === account);
		if (!Object.keys(voterVotes).length && !hasLegacyRecord) return sendJson(response, 404, { error: 'Voter not found.' });

		for (const candidate of state.candidates) {
			if (Object.values(voterVotes).includes(candidate.id) && candidate.votes > 0) candidate.votes -= 1;
		}
		state.votedAccounts = (state.votedAccounts || []).filter((item) => normalizeVoterAccount(item) !== account);
		if (state.voterVotes) delete state.voterVotes[account];
		await getRedis().set(stateKey, state);
		return sendJson(response, 200, { message: `${account} was removed from the voter list.` });
	} catch (error) {
		return handleApiError(response, error);
	}
}
