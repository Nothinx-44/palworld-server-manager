const { runNssm } = require('./palworldClient');

// Service Windows du dashboard lui-même (distinct du service du serveur Palworld). C'est ce qui
// permet au dashboard de rester joignable par les amis même appli de gestion fermée, et de
// redémarrer tout seul au boot de la machine.
const DASHBOARD_SERVICE_NAME = 'PalworldDashboard';

async function status() {
  try {
    const out = await runNssm(['status', DASHBOARD_SERVICE_NAME]);
    return { registered: true, running: /SERVICE_RUNNING/.test(out) };
  } catch {
    return { registered: false, running: false };
  }
}

// Installe (ou recrée) le service NSSM du dashboard. `home` est passé au service via une variable
// d'environnement pour qu'il lise le même .env / data/ que l'appli de gestion.
//
// Un service déjà existant est SUPPRIMÉ puis recréé de zéro, plutôt que mis à jour via `nssm set
// Application/AppParameters` sur la registration existante : en pratique, cette mise à jour en
// place s'est révélée peu fiable (un utilisateur devait systématiquement désinstaller puis
// réinstaller à la main pour qu'une nouvelle version du dashboard soit vraiment prise en compte).
// stop+remove+install reproduit exactement le chemin qui, lui, fonctionnait de façon fiable.
async function install({ nodeExe, serverJs, appDir, home }, onLog = () => {}) {
  const { registered } = await status();
  if (registered) {
    onLog(`Service "${DASHBOARD_SERVICE_NAME}" déjà présent : suppression avant recréation propre…`);
    try { await stop(); } catch (_) {}
    await runNssm(['remove', DASHBOARD_SERVICE_NAME, 'confirm']);
  }
  onLog(`Création du service "${DASHBOARD_SERVICE_NAME}"…`);
  await runNssm(['install', DASHBOARD_SERVICE_NAME, nodeExe, serverJs]);
  await runNssm(['set', DASHBOARD_SERVICE_NAME, 'AppDirectory', appDir]);
  await runNssm(['set', DASHBOARD_SERVICE_NAME, 'AppEnvironmentExtra', `PALWORLD_DASHBOARD_HOME=${home}`]);
  await runNssm(['set', DASHBOARD_SERVICE_NAME, 'Start', 'SERVICE_AUTO_START']);
  onLog('Service dashboard configuré (démarrage automatique avec Windows).');
}

function start() {
  return runNssm(['start', DASHBOARD_SERVICE_NAME]);
}

function stop() {
  return runNssm(['stop', DASHBOARD_SERVICE_NAME]);
}

// Arrête et supprime le service Windows du dashboard.
async function uninstall(onLog = () => {}) {
  try { await stop(); } catch (_) {}
  await runNssm(['remove', DASHBOARD_SERVICE_NAME, 'confirm']);
  onLog(`Service dashboard "${DASHBOARD_SERVICE_NAME}" supprimé.`);
}

module.exports = { install, start, stop, uninstall, status, DASHBOARD_SERVICE_NAME };
