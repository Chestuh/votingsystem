const candidateList = document.querySelector('.candidate-list');
const voteForm = document.querySelector('#vote-form');
const voteButton = document.querySelector('.vote-button');
const voteMessage = document.querySelector('#vote-message');
const totalVotesElement = document.querySelector('#total-votes');
const publicPosition = document.querySelector('#public-position');
const leaderboard = document.querySelector('#leaderboard');
const voterAccountInput = document.querySelector('#voter-account');
const voterAccountKey = 'voiceboard-voter-account';
let candidates = [];
let currentPosition = '';
let hasVoted = false;

function getVoterAccount() {
  return (voterAccountInput?.value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function restoreVoterAccount() {
  if (!voterAccountInput) return;
  const savedAccount = localStorage.getItem(voterAccountKey);
  if (savedAccount) voterAccountInput.value = savedAccount.trim();
}

function formatNumber(value) {
  return value.toLocaleString('en-US');
}

function escapeHTML(value) {
  return value.replace(/[&<>\'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

async function getCandidates() {
  const response = await fetch('/api/candidates', { cache: 'no-store' });
  const data = await readResponse(response);
  return data.candidates;
}

async function readResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('The ballot API is not configured on this deployment.');
  }
  if (!response.ok) throw new Error(data.error || 'Unable to load the ballot.');
  return data;
}

function renderPositionOptions() {
  if (!publicPosition) return;
  const positions = [...new Set(candidates.map((candidate) => candidate.position))];
  if (!positions.includes(currentPosition)) currentPosition = positions[0] || '';
  publicPosition.innerHTML = positions.map((position) => `<option value="${escapeHTML(position)}">${escapeHTML(position)}</option>`).join('');
  publicPosition.value = currentPosition;
}

function renderCandidates() {
  const visibleCandidates = candidates.filter((candidate) => candidate.position === currentPosition);
  candidateList.innerHTML = visibleCandidates.length
    ? visibleCandidates.map((candidate) => `<label class="candidate-card"><input type="radio" name="candidate" value="${candidate.id}" ${hasVoted ? 'disabled' : ''} /><span class="candidate-avatar avatar-${candidate.color}">${escapeHTML(getInitials(candidate.name))}</span><span class="candidate-details"><strong>${escapeHTML(candidate.name)}</strong><small>${escapeHTML(candidate.bio)}</small></span><span class="candidate-check" aria-hidden="true">✓</span></label>`).join('')
    : '<p class="empty-state">No candidates have been added for this office yet.</p>';
  candidateList.querySelectorAll('input[name="candidate"]').forEach((input) => {
    input.addEventListener('change', () => {
      voteButton.disabled = false;
      voteMessage.textContent = `You selected ${candidates.find((candidate) => candidate.id === input.value).name}. Ready to submit.`;
    });
  });
}

function renderResults() {
  const visibleCandidates = candidates.filter((candidate) => candidate.position === currentPosition);
  const totalVotes = visibleCandidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  const ranking = [...visibleCandidates].sort((first, second) => second.votes - first.votes);
  totalVotesElement.textContent = formatNumber(totalVotes);
  leaderboard.innerHTML = ranking.length
    ? ranking.map((candidate, index) => {
      const percentage = totalVotes ? Math.round((candidate.votes / totalVotes) * 100) : 0;
      const note = index === 0 ? `Leading by ${formatNumber(candidate.votes - (ranking[1]?.votes || 0))} votes` : index === 1 ? 'Steady pace' : index === 2 ? 'Gaining momentum' : 'Room to rise';
      return `<div class="result-row"><div class="result-info"><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="result-name">${escapeHTML(candidate.name)}</span><strong class="result-percent">${percentage}%</strong></div><div class="progress-track"><div class="progress-fill fill-${candidate.color}" style="--progress: ${percentage}%"></div></div><div class="result-count"><span>${note}</span><strong class="result-votes">${formatNumber(candidate.votes)} votes</strong></div></div>`;
    }).join('')
    : '<p class="empty-state empty-state-dark">No results yet. Ask an admin to add a candidate.</p>';
}

async function refreshBallot(showError = true) {
  try {
    candidates = await getCandidates();
    const positions = [...new Set(candidates.map((candidate) => candidate.position))];
    if (!positions.includes(currentPosition)) currentPosition = positions[0] || '';
    renderPositionOptions();
    renderCandidates();
    renderResults();
  } catch (error) {
    if (showError) voteMessage.textContent = 'The ballot server is unavailable. Please try again shortly.';
  }
}

if (publicPosition) {
  publicPosition.addEventListener('change', () => {
    const savedAccount = getVoterAccount();
    currentPosition = publicPosition.value;
    hasVoted = false;
    voteForm.reset();
    if (voterAccountInput) voterAccountInput.value = savedAccount;
    voteButton.disabled = true;
    voteButton.querySelector('span').textContent = 'Submit my vote';
    voteMessage.textContent = 'Your choice is private and can’t be changed.';
    renderCandidates();
    renderResults();
  });
}

voteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selectedId = new FormData(voteForm).get('candidate');
  const voterAccount = getVoterAccount();
  if (!selectedId || !voterAccount || hasVoted) return;
  if (!/^[A-Z0-9_]+#[0-9]{4}$/.test(voterAccount)) {
    voteButton.disabled = false;
    voteMessage.textContent = 'Use your IGN and 4-digit tag, for example Chizu#0328.';
    return;
  }
  voteButton.disabled = true;
  voteMessage.textContent = 'Submitting your vote...';
  try {
    localStorage.setItem(voterAccountKey, voterAccount);
    const response = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: selectedId, voterAccount, position: currentPosition }) });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || 'Vote could not be submitted.');
    hasVoted = true;
    voteButton.querySelector('span').textContent = 'Vote submitted';
    voteMessage.textContent = 'Thanks for making your voice count. Results are live.';
    await refreshBallot();
  } catch (error) {
    voteButton.disabled = false;
    voteMessage.textContent = error.message;
  }
});

restoreVoterAccount();
refreshBallot();
setInterval(() => refreshBallot(false), 5000);
