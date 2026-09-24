const loginPanel = document.querySelector('#login-panel');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const adminConsole = document.querySelector('#admin-console');
const candidateForm = document.querySelector('#candidate-form');
const directoryList = document.querySelector('#directory-list');
const candidateTotal = document.querySelector('#candidate-total');
const adminMessage = document.querySelector('#admin-message');
let candidates = [];

function escapeHTML(value) {
  return value.replace(/[&<>\'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
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

async function loadDirectory() {
  const data = await request('/api/candidates');
  candidates = data.candidates;
  candidateTotal.textContent = `${candidates.length} ${candidates.length === 1 ? 'candidate' : 'candidates'}`;
  directoryList.innerHTML = candidates.length
    ? candidates.map((candidate) => `<div class="directory-item"><span class="directory-avatar avatar-${candidate.color}">${escapeHTML(getInitials(candidate.name))}</span><span class="directory-details"><strong>${escapeHTML(candidate.name)}</strong><small>${escapeHTML(candidate.position)} · ${candidate.votes} votes</small></span><button class="remove-button" type="button" data-remove="${candidate.id}" aria-label="Remove ${escapeHTML(candidate.name)}">Remove</button></div>`).join('')
    : '<p class="empty-state">No candidates registered yet.</p>';
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

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  loginMessage.textContent = 'Signing in...';
  try {
    await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') }) });
    loginPanel.hidden = true;
    adminConsole.hidden = false;
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
