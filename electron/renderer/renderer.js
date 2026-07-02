const $ = id => document.getElementById(id);

const toast = $('toast');
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Ajuste la fenêtre à la hauteur réelle du contenu (pas de scroll interne). Appelé après chaque
// changement de contenu susceptible de modifier la hauteur.
function fitWindow() {
  if (!window.api || !window.api.fitWindow) return;
  window.api.fitWindow(0, document.documentElement.scrollHeight + 4);
}

function renderChecklist(status) {
  const items = [
    ['Droits administrateur', status.elevated],
    ['SteamCMD installé', status.steamCmdPresent],
    ['Serveur Palworld installé', status.serverInstalled],
    ['Service serveur enregistré', status.serviceRegistered],
    ['API REST configurée', status.restApiConfigured],
    ['Service dashboard enregistré', status.dashboard && status.dashboard.registered]
  ];
  $('checklist').innerHTML = items.map(([label, ok]) =>
    `<li><span class="check-icon${ok ? ' ok' : ''}">${ok ? '✓' : '○'}</span> ${label}</li>`
  ).join('');
  $('elevatedWarning').style.display = status.elevated ? 'none' : 'block';
}

function renderDashPill(status) {
  const dash = status.dashboard || {};
  const pill = $('dashPill');
  if (dash.running) { pill.textContent = 'Dashboard : en ligne'; pill.classList.add('on'); }
  else { pill.textContent = dash.registered ? 'Dashboard : arrêté' : 'Dashboard : non installé'; pill.classList.remove('on'); }
}

function renderShare(status) {
  const running = status.dashboard && status.dashboard.running;
  $('shareBox').style.display = running ? 'block' : 'none';
  $('shareHint').style.display = running ? 'block' : 'none';
  if (running) {
    $('shareUrl').textContent = `http://${status.localIp}:${status.port}  (en local)`;
    $('shareHint').textContent = `IP locale ${status.localIp}. Pour tes amis : redirige un port externe de ta box vers ${status.localIp}:${status.port} (TCP), puis donne-leur http://TON.IP.PUBLIQUE:PORT_EXTERNE.`;
  }
}

function renderAccounts(accounts) {
  const body = $('accountsBody');
  body.innerHTML = (accounts || []).map(u =>
    `<tr><td>${escapeHtml(u.username)}</td><td>${u.role === 'admin' ? 'Admin' : 'Lecture seule'}</td></tr>`
  ).join('');
  $('accountsEmpty').style.display = (accounts && accounts.length) ? 'none' : 'block';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fillForm(current = {}) {
  $('installDir').value = current.installDir || '';
  $('steamCmdDir').value = current.steamCmdDir || '';
  $('maxPlayers').value = current.maxPlayers || 8;
  $('port').value = current.port || 8211;
  $('restApiPort').value = current.restApiPort || 8212;
  $('backupDir').value = current.backupDir || '';
}

async function refresh() {
  const status = await window.api.getStatus();
  if (!status) return;
  renderChecklist(status);
  renderDashPill(status);
  renderShare(status);
  renderAccounts(status.accounts);
  fillForm(status.current || {});
  fitWindow();
}

// ---------- Installation ----------
// Boutons « Parcourir… » : ouvrent l'explorateur Windows et remplissent le champ de dossier.
document.querySelectorAll('.browse-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const input = $(btn.dataset.target);
    const picked = await window.api.pickFolder(input.value);
    if (picked) input.value = picked;
  });
});

window.api.onLog(line => {
  const log = $('log');
  log.style.display = 'block';
  log.textContent += line + '\n';
  log.scrollTop = log.scrollHeight;
});

$('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('setupError').textContent = '';
  const body = {
    installDir: $('installDir').value.trim(),
    steamCmdDir: $('steamCmdDir').value.trim(),
    serverName: $('serverName').value.trim(),
    serverPassword: $('serverPassword').value,
    adminPassword: $('adminPassword').value,
    maxPlayers: $('maxPlayers').value,
    port: $('port').value,
    restApiPort: $('restApiPort').value,
    backupDir: $('backupDir').value.trim()
  };
  $('installBtn').disabled = true;
  $('log').style.display = 'block';
  $('log').textContent = '';
  fitWindow();
  const r = await window.api.install(body);
  $('installBtn').disabled = false;
  if (r && r.ok) showToast('Installation terminée');
  else $('setupError').textContent = (r && r.error) || "Échec de l'installation.";
  refresh();
});

// ---------- Lancement ----------
$('startDashBtn').addEventListener('click', async () => {
  const r = await window.api.startDashboard();
  showToast(r && r.ok ? 'Dashboard démarré' : `Échec : ${(r && r.error) || ''}`);
  setTimeout(refresh, 1500);
});

$('stopDashBtn').addEventListener('click', async () => {
  const r = await window.api.stopDashboard();
  showToast(r && r.ok ? 'Dashboard arrêté' : `Échec : ${(r && r.error) || ''}`);
  setTimeout(refresh, 1500);
});

$('openDashBtn').addEventListener('click', () => window.api.openDashboard());

// ---------- Services Windows ----------
async function runServiceAction(btnId, apiFn, okMsg) {
  const btn = $(btnId);
  btn.disabled = true;
  $('log').style.display = 'block';
  $('log').textContent = '';
  fitWindow();
  const r = await apiFn();
  btn.disabled = false;
  showToast(r && r.ok ? okMsg : `Échec : ${(r && r.error) || ''}`);
  refresh();
}

$('installServicesBtn').addEventListener('click', () =>
  runServiceAction('installServicesBtn', window.api.installServices, 'Services installés'));

$('uninstallServicesBtn').addEventListener('click', () => {
  if (!confirm('Supprimer les services Windows (serveur + dashboard) ? Le serveur installé et les sauvegardes ne sont pas touchés.')) return;
  runServiceAction('uninstallServicesBtn', window.api.uninstallServices, 'Services désinstallés');
});

// ---------- Comptes ----------
$('accountForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('accountError').textContent = '';
  const r = await window.api.createAccount({
    username: $('newUsername').value.trim(),
    password: $('newPassword').value,
    role: $('newRole').value
  });
  if (r && r.ok) {
    showToast('Compte créé');
    e.target.reset();
    renderAccounts(r.accounts);
    fitWindow();
  } else {
    $('accountError').textContent = (r && r.error) || 'Échec de la création.';
  }
});

window.addEventListener('load', fitWindow);
refresh();
