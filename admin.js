const loginPanel = document.querySelector('#login-panel');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const adminConsole = document.querySelector('#admin-console');
const candidateForm = document.querySelector('#candidate-form');
const pollForm = document.querySelector('#poll-form');
const pollClosesAtInput = document.querySelector('#poll-closes-at');
const directoryList = document.querySelector('#directory-list');
const candidateTotal = document.querySelector('#candidate-total');
const resultsList = document.querySelector('#admin-results-list');
const resultsTotal = document.querySelector('#results-total');
const adminMessage = document.querySelector('#admin-message');
const pollMessage = document.querySelector('#poll-message');
const voterList = document.querySelector('#voter-list');
const voterEmpty = document.querySelector('#voter-empty');
const voterMessage = document.querySelector('#voter-message');
const viewButtons = document.querySelectorAll('[data-view]');
const viewPanels = document.querySelectorAll('[data-view-panel]');
let candidates = [];

function escapeHTML(value) {
  return value.replace(/[&<>\'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function renderAdminResults() {
  const positionGroups = candidates.reduce((groups, candidate) => {
    if (!groups[candidate.position]) groups[candidate.position] = [];
    groups[candidate.position].push(candidate);
    return groups;
  }, {});
  const totalVotes = candidates.reduce((sum, candidate) => sum + Number(candidate.votes || 0), 0);
  resultsTotal.textContent = `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;
  resultsList.innerHTML = Object.keys(positionGroups).length
    ? Object.entries(positionGroups).map(([position, positionCandidates]) => {
      const positionTotal = positionCandidates.reduce((sum, candidate) => sum + Number(candidate.votes || 0), 0);
      const rows = [...positionCandidates].sort((first, second) => second.votes - first.votes).map((candidate) => {
        const percentage = positionTotal ? Math.round((candidate.votes / positionTotal) * 100) : 0;
        return `<div class="admin-result-row"><div class="admin-result-heading"><span>${escapeHTML(candidate.name)}</span><strong>${candidate.votes} votes</strong></div><div class="admin-result-track"><span class="admin-result-fill fill-${candidate.color}" style="--result-progress: ${percentage}%"></span></div><small>${percentage}% of ${escapeHTML(position)}</small></div>`;
      }).join('');
      return `<section class="admin-result-group"><h3>${escapeHTML(position)}</h3>${rows}</section>`;
    }).join('')
    : '<p class="empty-state">No vote results yet.</p>';
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('The admin API is not configured on this deployment.');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function toLocalDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return local;
}

async function loadPollSettings() {
  const data = await request('/api/candidates');
  if (pollClosesAtInput && data.pollEndsAt) pollClosesAtInput.value = toLocalDateTimeValue(data.pollEndsAt);
}

async function loadDirectory() {
  const data = await request('/api/candidates');
  candidates = data.candidates;
  if (pollClosesAtInput && data.pollEndsAt) pollClosesAtInput.value = toLocalDateTimeValue(data.pollEndsAt);
  candidateTotal.textContent = `${candidates.length} ${candidates.length === 1 ? 'candidate' : 'candidates'}`;
  directoryList.innerHTML = candidates.length
    ? candidates.map((candidate) => `<div class="directory-item"><span class="directory-avatar avatar-${candidate.color}">${escapeHTML(getInitials(candidate.name))}</span><span class="directory-details"><strong>${escapeHTML(candidate.name)}</strong><small>${escapeHTML(candidate.position)} · ${candidate.votes} votes</small></span><button class="remove-button" type="button" data-remove="${candidate.id}" aria-label="Remove ${escapeHTML(candidate.name)}">Remove</button></div>`).join('')
    : '<p class="empty-state">No candidates registered yet.</p>';
  renderAdminResults();
  directoryList.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const data = await request(`/api/admin/candidates/${encodeURIComponent(button.dataset.remove)}`, { method: 'DELETE' });
        await loadDirectory();
        adminMessage.textContent = data.message;
      } catch (error) {
        button.disabled = false;
        adminMessage.textContent = error.message;
      }
    });
  });
}

async function loadVoters() {
  const data = await request('/api/admin/voters');
  voterList.innerHTML = data.voters.map((voter, index) => `<tr><td>${String(index + 1).padStart(2, '0')}</td><td><strong>${escapeHTML(voter.account)}</strong></td><td>${voter.votes}</td><td><button class="remove-button" type="button" data-delete-voter="${encodeURIComponent(voter.id)}" aria-label="Delete ${escapeHTML(voter.account)}">Delete user</button></td></tr>`).join('');
  voterEmpty.hidden = data.voters.length > 0;
  voterList.querySelectorAll('[data-delete-voter]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const data = await request(`/api/admin/voters/${button.dataset.deleteVoter}`, { method: 'DELETE' });
        await loadVoters();
        await loadDirectory();
        voterMessage.textContent = data.message;
      } catch (error) {
        button.disabled = false;
        voterMessage.textContent = error.message;
      }
    });
  });
}

viewButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    viewButtons.forEach((item) => item.classList.toggle('is-active', item === button));
    viewPanels.forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== button.dataset.view; });
    if (button.dataset.view === 'voters') {
      try { await loadVoters(); } catch (error) { voterMessage.textContent = error.message; }
    }
  });
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  loginMessage.textContent = 'Signing in...';
  try {
    await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') }) });
    loginPanel.hidden = true;
    adminConsole.hidden = false;
    await loadPollSettings();
    await loadDirectory();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

candidateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(candidateForm);
  const payload = { name: formData.get('name').trim(), position: formData.get('position'), bio: formData.get('bio').trim() };
  try {
    const data = await request('/api/admin/candidates', { method: 'POST', body: JSON.stringify(payload) });
    candidateForm.reset();
    await loadDirectory();
    adminMessage.textContent = data.message;
  } catch (error) {
    adminMessage.textContent = error.message;
  }
});

pollForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!pollClosesAtInput || !pollClosesAtInput.value) {
    pollMessage.textContent = 'Choose a time for the poll to close.';
    return;
  }
  try {
    const data = await request('/api/admin/poll', { method: 'POST', body: JSON.stringify({ pollClosesAt: new Date(pollClosesAtInput.value).toISOString() }) });
    const selectedTime = new Date(pollClosesAtInput.value);
    pollMessage.textContent = `The poll closes on ${selectedTime.toLocaleString()}.`;
    if (data.pollEndsAt) pollClosesAtInput.value = toLocalDateTimeValue(data.pollEndsAt);
  } catch (error) {
    pollMessage.textContent = error.message;
  }
});
