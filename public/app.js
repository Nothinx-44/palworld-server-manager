const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const playersBody = document.getElementById('playersBody');
const playersEmpty = document.getElementById('playersEmpty');
const backupList = document.getElementById('backupList');
const activityList = document.getElementById('activityList');
const sessionsList = document.getElementById('sessionsList');
const totalsList = document.getElementById('totalsList');
const totalsEmpty = document.getElementById('totalsEmpty');
const roleBadge = document.getElementById('roleBadge');
const toast = document.getElementById('toast');

let currentRole = 'viewer';
let currentUsername = '';

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return null;
  }
  return res.json();
}

async function loadMe() {
  const data = await api('GET', '/api/me');
  if (!data || !data.user) return;
  currentRole = data.user.role;
  currentUsername = data.user.username;
  roleBadge.textContent = currentRole === 'admin' ? 'Admin' : 'Lecture seule';
  if (currentRole !== 'admin') {
    document.querySelectorAll('[data-admin-only]').forEach(el => el.style.display = 'none');
  }
}

async function refreshStatus() {
  const data = await api('GET', '/api/status');
  if (!data) return;

  if (data.online) {
    statusDot.classList.add('online');
    const nbPlayers = (data.players || []).length;
    statusText.innerHTML = `En ligne <span class="muted">— ${nbPlayers} joueur(s) connecté(s)</span>`;
    renderPlayers(data.players || []);
  } else {
    statusDot.classList.remove('online');
    statusText.textContent = 'Serveur arrêté ou injoignable';
    renderPlayers([]);
  }
}

function renderPlayers(players) {
  playersBody.innerHTML = '';
  if (!players.length) {
    playersEmpty.style.display = 'block';
    return;
  }
  playersEmpty.style.display = 'none';
  players.forEach(p => {
    const tr = document.createElement('tr');
    const kickCell = currentRole === 'admin'
      ? `<button class="kick-btn" data-userid="${escapeHtml(p.userId || '')}">Kick</button>`
      : '';
    tr.innerHTML = `
      <td>${escapeHtml(p.name || '—')}</td>
      <td>${p.level ?? '—'}</td>
      <td>${p.ping ?? '—'}</td>
      <td>${kickCell}</td>
    `;
    playersBody.appendChild(tr);
  });
  document.querySelectorAll('.kick-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Exclure ce joueur du serveur ?')) return;
      const r = await api('POST', '/api/kick', { userid: btn.dataset.userid });
      if (r && r.ok) { showToast('Joueur exclu'); refreshStatus(); }
      else showToast('Échec du kick');
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function refreshBackups() {
  const data = await api('GET', '/api/backups');
  if (!data) return;
  backupList.innerHTML = '';
  if (!data.backups.length) {
    backupList.innerHTML = '<li>Aucune sauvegarde pour le moment.</li>';
    return;
  }
  data.backups.forEach(b => {
    const li = document.createElement('li');
    const sizeMb = (b.size / 1024 / 1024).toFixed(1);
    const date = new Date(b.date).toLocaleString('fr-FR');
    li.innerHTML = `<span>${date} — ${sizeMb} Mo</span><a href="/api/backups/${encodeURIComponent(b.filename)}">Télécharger</a>`;
    backupList.appendChild(li);
  });
}

async function refreshActivity() {
  const data = await api('GET', '/api/activity');
  if (!data) return;
  activityList.innerHTML = '';
  if (!data.entries.length) {
    activityList.innerHTML = '<li>Aucune activité enregistrée.</li>';
    return;
  }
  const labels = {
    start: 'a démarré le serveur',
    stop: 'a arrêté le serveur',
    'stop-forced': 'a forcé l\'arrêt du serveur',
    restart: 'a redémarré le serveur',
    backup: 'a lancé une sauvegarde',
    announce: 'a envoyé une annonce',
    kick: 'a exclu un joueur',
    'auto-restart': 'redémarrage automatique (watchdog)',
    'restart-warning': 'annonce de redémarrage planifié',
    'restart-skipped': 'redémarrage planifié ignoré (un autre était en cours)',
    'user-create': 'a créé un compte',
    'user-update': 'a modifié un compte',
    'user-delete': 'a supprimé un compte',
    'password-change': 'a changé son mot de passe',
    'steam-update-check': 'vérification de mise à jour SteamCMD'
  };
  data.entries.slice(0, 15).forEach(e => {
    const li = document.createElement('li');
    const date = new Date(e.ts).toLocaleString('fr-FR');
    const label = labels[e.action] || e.action;
    li.innerHTML = `<span>${escapeHtml(e.username)} ${label}</span><span>${date}</span>`;
    activityList.appendChild(li);
  });
}

async function refreshPlayerHistory() {
  const data = await api('GET', '/api/players/history');
  if (!data) return;

  totalsList.innerHTML = '';
  const totalsEntries = Object.entries(data.totals || {});
  if (!totalsEntries.length) {
    totalsEmpty.style.display = 'block';
  } else {
    totalsEmpty.style.display = 'none';
    // On récupère un nom lisible depuis les sessions plutôt que d'afficher le userId brut
    const nameByUserId = {};
    (data.sessions || []).forEach(s => { nameByUserId[s.userId] = s.name; });
    totalsEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([userId, minutes]) => {
        const li = document.createElement('li');
        const hours = (minutes / 60).toFixed(1);
        li.innerHTML = `<span>${escapeHtml(nameByUserId[userId] || userId)}</span><span>${hours} h au total</span>`;
        totalsList.appendChild(li);
      });
  }

  sessionsList.innerHTML = '';
  if (!data.sessions || !data.sessions.length) {
    sessionsList.innerHTML = '<li>Aucune session enregistrée.</li>';
  } else {
    data.sessions.slice(0, 10).forEach(s => {
      const li = document.createElement('li');
      const joined = new Date(s.joined).toLocaleString('fr-FR');
      const status = s.left ? `parti à ${new Date(s.left).toLocaleTimeString('fr-FR')}` : 'en ligne';
      li.innerHTML = `<span>${escapeHtml(s.name)}</span><span>${joined} — ${status}</span>`;
      sessionsList.appendChild(li);
    });
  }
}

function actionError(r, fallback) {
  return r && r.error === 'restart_in_progress' ? 'Impossible : un redémarrage est déjà en cours' : fallback;
}

document.getElementById('startBtn').addEventListener('click', async () => {
  const r = await api('POST', '/api/start');
  showToast(r && r.ok ? 'Démarrage du serveur…' : actionError(r, 'Échec du démarrage'));
  setTimeout(refreshStatus, 4000);
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  if (!confirm('Arrêter le serveur ? Les joueurs connectés seront déconnectés.')) return;
  const r = await api('POST', '/api/stop');
  showToast(r && r.ok ? 'Arrêt en cours (sauvegarde puis coupure)…' : actionError(r, 'Échec de l\'arrêt'));
  setTimeout(refreshStatus, 12000);
});

document.getElementById('restartBtn').addEventListener('click', async () => {
  if (!confirm('Redémarrer le serveur ? Les joueurs connectés seront déconnectés quelques instants.')) return;
  const r = await api('POST', '/api/restart');
  showToast(r && r.ok ? 'Redémarrage en cours…' : actionError(r, 'Échec du redémarrage'));
  setTimeout(refreshStatus, 20000);
});

document.getElementById('backupBtn').addEventListener('click', async () => {
  showToast('Sauvegarde en cours…');
  const r = await api('POST', '/api/backup');
  showToast(r && r.ok ? 'Sauvegarde terminée' : 'Échec de la sauvegarde');
  refreshBackups();
  refreshActivity();
});

document.getElementById('announceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('announceInput');
  const r = await api('POST', '/api/announce', { message: input.value });
  showToast(r && r.ok ? 'Annonce envoyée' : 'Échec de l\'annonce');
  if (r && r.ok) input.value = '';
  refreshActivity();
});

async function refreshUsers() {
  if (currentRole !== 'admin') return;
  const data = await api('GET', '/api/users');
  if (!data) return;
  const usersBody = document.getElementById('usersBody');
  usersBody.innerHTML = '';
  data.users.forEach(u => {
    const tr = document.createElement('tr');
    const isSelf = u.username === currentUsername;
    tr.innerHTML = `
      <td>${escapeHtml(u.username)}${isSelf ? ' <span class="role-badge">toi</span>' : ''}</td>
      <td>
        <select class="role-select" data-username="${escapeHtml(u.username)}" ${isSelf ? 'disabled' : ''}>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Lecture seule</option>
        </select>
      </td>
      <td class="row-actions">
        <button class="icon-btn" data-reset="${escapeHtml(u.username)}">Réinitialiser mdp</button>
        <button class="icon-btn danger" data-delete="${escapeHtml(u.username)}" ${isSelf ? 'disabled' : ''}>Supprimer</button>
      </td>
    `;
    usersBody.appendChild(tr);
  });

  usersBody.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const r = await api('PUT', `/api/users/${encodeURIComponent(sel.dataset.username)}`, { role: sel.value });
      if (r && r.ok) showToast('Rôle mis à jour');
      else {
        showToast(r && r.error === 'last_admin' ? 'Impossible : il doit rester au moins un admin' : 'Échec de la mise à jour');
        refreshUsers();
      }
    });
  });

  usersBody.querySelectorAll('[data-reset]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newPass = prompt(`Nouveau mot de passe pour ${btn.dataset.reset} :`);
      if (!newPass) return;
      if (newPass.length < 6) { showToast('6 caractères minimum'); return; }
      const r = await api('PUT', `/api/users/${encodeURIComponent(btn.dataset.reset)}`, { password: newPass });
      showToast(r && r.ok ? 'Mot de passe réinitialisé' : 'Échec de la réinitialisation');
    });
  });

  usersBody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Supprimer le compte "${btn.dataset.delete}" ?`)) return;
      const r = await api('DELETE', `/api/users/${encodeURIComponent(btn.dataset.delete)}`);
      if (r && r.ok) { showToast('Compte supprimé'); refreshUsers(); }
      else showToast(r && r.error === 'last_admin' ? 'Impossible : il doit rester au moins un admin' : 'Échec de la suppression');
    });
  });
}

document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role = document.getElementById('newUserRole').value;
  const errorEl = document.getElementById('createUserError');
  errorEl.textContent = '';
  const r = await api('POST', '/api/users', { username, password, role });
  if (r && r.ok) {
    showToast('Compte créé');
    e.target.reset();
    refreshUsers();
  } else {
    errorEl.textContent = r && r.error === 'already_exists' ? 'Ce nom d\'utilisateur existe déjà.' : 'Échec de la création du compte.';
  }
});

document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const errorEl = document.getElementById('passwordError');
  errorEl.textContent = '';
  const r = await api('POST', '/api/me/password', { currentPassword, newPassword });
  if (r && r.ok) {
    showToast('Mot de passe changé');
    e.target.reset();
  } else {
    errorEl.textContent = r && r.error === 'invalid_current_password' ? 'Mot de passe actuel incorrect.' : 'Échec du changement de mot de passe.';
  }
});

// ---------- Installation du serveur Palworld ----------
const setupChecklist = document.getElementById('setupChecklist');
const setupElevatedWarning = document.getElementById('setupElevatedWarning');
const setupForm = document.getElementById('setupForm');
const setupToggleBtn = document.getElementById('setupToggleBtn');
const setupSubmitBtn = document.getElementById('setupSubmitBtn');
const setupError = document.getElementById('setupError');
const setupLogEl = document.getElementById('setupLog');

function renderSetupChecklist(status) {
  const items = [
    ['SteamCMD installé', status.steamCmdPresent],
    ['Serveur Palworld installé', status.serverInstalled],
    ['Service Windows enregistré', status.serviceRegistered],
    ['API REST configurée', status.restApiConfigured]
  ];
  setupChecklist.innerHTML = '';
  items.forEach(([label, ok]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="check-icon${ok ? ' ok' : ''}">${ok ? '✓' : '○'}</span> ${label}`;
    setupChecklist.appendChild(li);
  });
  setupElevatedWarning.style.display = status.elevated ? 'none' : 'block';
}

function fillSetupForm(current) {
  document.getElementById('setupInstallDir').value = current.installDir || '';
  document.getElementById('setupSteamCmdDir').value = current.steamCmdDir || '';
  document.getElementById('setupNssmPath').value = current.nssmPath || '';
  document.getElementById('setupServiceName').value = current.serviceName || '';
  document.getElementById('setupMaxPlayers').value = current.maxPlayers || 8;
  document.getElementById('setupPort').value = current.port || 8211;
  document.getElementById('setupRestApiPort').value = current.restApiPort || 8212;
  document.getElementById('setupBackupDir').value = current.backupDir || '';
}

async function refreshSetupStatus() {
  if (currentRole !== 'admin') return;
  const data = await api('GET', '/api/setup/status');
  if (!data || data.error) return;
  renderSetupChecklist(data);
  fillSetupForm(data.current || {});
  if (data.installing) {
    setupForm.style.display = 'block';
    setupSubmitBtn.disabled = true;
    setupLogEl.style.display = 'block';
    listenSetupStream();
  }
}

let setupEventSource = null;
function listenSetupStream() {
  if (setupEventSource) return;
  setupEventSource = new EventSource('/api/setup/stream');
  setupEventSource.onmessage = (e) => {
    const entry = JSON.parse(e.data);
    setupLogEl.textContent += entry.line + '\n';
    setupLogEl.scrollTop = setupLogEl.scrollHeight;
  };
  setupEventSource.addEventListener('done', (e) => {
    const payload = e.data ? JSON.parse(e.data) : {};
    showToast(payload.ok === false ? `Échec de l'installation : ${payload.error || ''}` : 'Installation terminée');
    setupSubmitBtn.disabled = false;
    setupEventSource.close();
    setupEventSource = null;
    refreshSetupStatus();
  });
  setupEventSource.onerror = () => {
    setupEventSource.close();
    setupEventSource = null;
  };
}

setupToggleBtn.addEventListener('click', () => {
  setupForm.style.display = setupForm.style.display === 'none' ? 'block' : 'none';
});

setupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setupError.textContent = '';
  const body = {
    installDir: document.getElementById('setupInstallDir').value.trim(),
    steamCmdDir: document.getElementById('setupSteamCmdDir').value.trim(),
    nssmPath: document.getElementById('setupNssmPath').value.trim(),
    serviceName: document.getElementById('setupServiceName').value.trim(),
    serverName: document.getElementById('setupServerName').value.trim(),
    serverPassword: document.getElementById('setupServerPassword').value,
    adminPassword: document.getElementById('setupAdminPassword').value,
    maxPlayers: document.getElementById('setupMaxPlayers').value,
    port: document.getElementById('setupPort').value,
    restApiPort: document.getElementById('setupRestApiPort').value,
    backupDir: document.getElementById('setupBackupDir').value.trim()
  };
  const r = await api('POST', '/api/setup/install', body);
  if (r && r.ok) {
    setupSubmitBtn.disabled = true;
    setupLogEl.style.display = 'block';
    setupLogEl.textContent = '';
    listenSetupStream();
  } else {
    setupError.textContent = r && r.error === 'admin_password_required'
      ? 'Mot de passe admin requis (6 caractères min.).'
      : r && r.error === 'install_in_progress'
        ? 'Une installation est déjà en cours.'
        : 'Échec du lancement de l\'installation.';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('POST', '/api/logout');
  window.location.href = '/login.html';
});

(async function init() {
  await loadMe();
  refreshStatus();
  refreshBackups();
  refreshActivity();
  refreshPlayerHistory();
  refreshUsers();
  refreshSetupStatus();
  setInterval(refreshStatus, 15000);
  setInterval(refreshActivity, 30000);
  setInterval(refreshPlayerHistory, 30000);
})();
