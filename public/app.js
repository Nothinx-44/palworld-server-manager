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

  renderScheduledBanner(data.scheduledRestartAt);

  if (data.online) {
    statusDot.classList.add('online');
    const nbPlayers = (data.players || []).length;
    statusText.innerHTML = `En ligne <span class="muted">— ${nbPlayers} joueur(s) connecté(s)</span>`;
    renderPlayers(data.players || []);
    renderServerInfo(data);
  } else {
    statusDot.classList.remove('online');
    statusText.textContent = 'Serveur arrêté ou injoignable';
    renderPlayers([]);
    renderServerInfo(null);
  }
  if (window.updateMapPlayers) window.updateMapPlayers(data.online ? data.players || [] : []);
}

function formatUptime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${min}min`);
  return parts.join(' ');
}

function renderServerInfo(data) {
  const set = (id, val) => { document.getElementById(id).textContent = val; };
  if (!data) {
    set('infoOnline', 'Hors ligne');
    ['infoVersion', 'infoPlayers', 'infoUptime', 'infoFps', 'infoDays'].forEach(id => set(id, '—'));
    return;
  }
  const m = data.metrics || {};
  set('infoOnline', 'En ligne');
  set('infoVersion', (data.info && data.info.version) || '—');
  set('infoPlayers', `${(data.players || []).length}${m.maxplayernum != null ? '/' + m.maxplayernum : ''}`);
  set('infoUptime', m.uptime != null ? formatUptime(m.uptime) : '—');
  set('infoFps', m.serverfps != null ? String(m.serverfps) : '—');
  set('infoDays', m.days != null ? String(m.days) : '—');
}

function renderScheduledBanner(at) {
  const banner = document.getElementById('scheduledBanner');
  if (!at) { banner.style.display = 'none'; return; }
  const mins = Math.max(0, Math.round((at - Date.now()) / 60000));
  document.getElementById('scheduledText').textContent =
    `⏳ Redémarrage programmé dans ~${mins} min.`;
  banner.style.display = 'flex';
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
    const actions = currentRole === 'admin'
      ? `<div class="row-actions">
           <button class="kick-btn" data-userid="${escapeHtml(p.userId || '')}">Kick</button>
           <button class="ban-btn" data-userid="${escapeHtml(p.userId || '')}" data-name="${escapeHtml(p.name || '')}">Bannir</button>
         </div>`
      : '';
    tr.innerHTML = `
      <td>${escapeHtml(p.name || '—')}</td>
      <td>${p.level ?? '—'}</td>
      <td>${p.ping ?? '—'}</td>
      <td>${actions}</td>
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
  document.querySelectorAll('.ban-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Bannir ${btn.dataset.name || 'ce joueur'} ? Il sera déconnecté et ne pourra plus se reconnecter.`)) return;
      const r = await api('POST', '/api/ban', { userid: btn.dataset.userid, name: btn.dataset.name });
      if (r && r.ok) { showToast('Joueur banni'); refreshStatus(); refreshBans(); refreshActivity(); }
      else showToast('Échec du ban');
    });
  });
}

async function refreshBans() {
  if (currentRole !== 'admin') return;
  const data = await api('GET', '/api/bans');
  if (!data) return;
  const list = document.getElementById('bansList');
  const empty = document.getElementById('bansEmpty');
  list.innerHTML = '';
  if (!data.bans.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  data.bans.forEach(b => {
    const li = document.createElement('li');
    const date = new Date(b.ts).toLocaleString('fr-FR');
    li.innerHTML = `<span>${escapeHtml(b.name)} <span class="muted">— banni le ${date}</span></span>`;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.textContent = 'Débannir';
    btn.addEventListener('click', async () => {
      const r = await api('POST', '/api/unban', { userid: b.userId });
      if (r && r.ok) { showToast('Joueur débanni'); refreshBans(); refreshActivity(); }
      else showToast('Échec du déban');
    });
    li.appendChild(btn);
    list.appendChild(li);
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
    save: 'a sauvegardé le monde',
    announce: 'a envoyé une annonce',
    kick: 'a exclu un joueur',
    ban: 'a banni un joueur',
    unban: 'a débanni un joueur',
    'force-stop': 'a forcé l\'arrêt du serveur',
    'restart-scheduled': 'a programmé un redémarrage',
    'restart-cancelled': 'a annulé le redémarrage programmé',
    'update-check': 'a vérifié les mises à jour',
    'update-apply': 'a lancé une mise à jour du serveur',
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

document.getElementById('saveWorldBtn').addEventListener('click', async () => {
  const r = await api('POST', '/api/save');
  showToast(r && r.ok ? 'Monde sauvegardé' : actionError(r, 'Échec de la sauvegarde'));
  refreshActivity();
});

document.getElementById('forceStopBtn').addEventListener('click', async () => {
  if (!confirm('Forcer l\'arrêt immédiat ? Aucune sauvegarde préalable — à réserver aux cas où le serveur est bloqué.')) return;
  const r = await api('POST', '/api/force-stop');
  showToast(r && r.ok ? 'Arrêt forcé envoyé' : actionError(r, 'Échec de l\'arrêt forcé'));
  setTimeout(refreshStatus, 5000);
});

document.getElementById('scheduleRestartBtn').addEventListener('click', async () => {
  const minutes = parseInt(document.getElementById('restartMinutes').value, 10) || 5;
  const r = await api('POST', '/api/schedule-restart', { minutes });
  showToast(r && r.ok ? `Redémarrage programmé dans ${r.minutes} min` : actionError(r, 'Échec de la programmation'));
  refreshStatus();
  refreshActivity();
});

document.getElementById('cancelRestartBtn').addEventListener('click', async () => {
  const r = await api('POST', '/api/cancel-restart');
  showToast(r && r.ok ? 'Redémarrage annulé' : 'Aucun redémarrage à annuler');
  refreshStatus();
  refreshActivity();
});

document.getElementById('loadSettingsBtn').addEventListener('click', async () => {
  const list = document.getElementById('settingsList');
  list.innerHTML = '<li><span>Chargement…</span><b></b></li>';
  const data = await api('GET', '/api/settings');
  if (!data || data.error) {
    list.innerHTML = '<li><span>Serveur injoignable</span><b>—</b></li>';
    return;
  }
  const settings = data.settings || {};
  list.innerHTML = '';
  Object.entries(settings).forEach(([key, value]) => {
    const li = document.createElement('li');
    const val = typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value);
    li.innerHTML = `<span>${escapeHtml(key)}</span><b>${escapeHtml(val)}</b>`;
    list.appendChild(li);
  });
});

// ---------- Mise à jour du serveur ----------
document.getElementById('checkUpdateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('checkUpdateBtn');
  const status = document.getElementById('updateStatus');
  const applyBtn = document.getElementById('applyUpdateBtn');
  btn.disabled = true;
  status.textContent = 'Vérification en cours… (SteamCMD démarre, ~30-60 s)';
  const r = await api('GET', '/api/update/check');
  btn.disabled = false;
  if (!r || r.error) {
    status.textContent = `Échec de la vérification : ${(r && r.error) || 'erreur inconnue'}`;
    applyBtn.style.display = 'none';
    return;
  }
  if (r.updateAvailable) {
    status.textContent = `⬆️ Mise à jour disponible : build ${r.installedBuild} → ${r.latestBuild}.`;
    applyBtn.style.display = 'inline-block';
  } else {
    status.textContent = r.installedBuild
      ? `✅ Serveur à jour (build ${r.installedBuild}).`
      : `Build installé illisible — dernier build Steam : ${r.latestBuild}.`;
    applyBtn.style.display = 'none';
  }
  refreshActivity();
});

document.getElementById('applyUpdateBtn').addEventListener('click', async () => {
  if (!confirm('Appliquer la mise à jour ? Si le serveur tourne, il sera redémarré (arrêt propre + update + relance).')) return;
  const r = await api('POST', '/api/update/apply');
  if (r && r.ok) {
    showToast(r.wasRunning ? 'Mise à jour lancée, le serveur redémarre…' : 'Mise à jour lancée (serveur arrêté, il le restera)');
    document.getElementById('applyUpdateBtn').style.display = 'none';
    document.getElementById('updateStatus').textContent = 'Mise à jour en cours… (suivi dans le journal d\'activité et Discord)';
  } else {
    showToast(actionError(r, 'Échec du lancement de la mise à jour'));
  }
  refreshActivity();
});

// Messages préréglés : boutons rapides qui envoient une annonce en un clic
const PRESET_MESSAGES = [
  'Sauvegarde imminente, tenez-vous prêts.',
  'Redémarrage bientôt, mettez-vous en lieu sûr.',
  'Bienvenue sur le serveur, amusez-vous bien !',
  'Bonne nuit à tous, le serveur reste allumé.'
];
(function renderPresets() {
  const row = document.getElementById('presetRow');
  if (!row) return;
  PRESET_MESSAGES.forEach(msg => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.type = 'button';
    btn.textContent = msg.length > 34 ? msg.slice(0, 32) + '…' : msg;
    btn.title = msg;
    btn.addEventListener('click', async () => {
      const r = await api('POST', '/api/announce', { message: msg });
      showToast(r && r.ok ? 'Annonce envoyée' : 'Échec de l\'annonce');
      refreshActivity();
    });
    row.appendChild(btn);
  });
})();

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
  refreshBans();
  refreshSetupStatus();
  setInterval(refreshStatus, 15000);
  setInterval(refreshActivity, 30000);
  setInterval(refreshPlayerHistory, 30000);
})();
