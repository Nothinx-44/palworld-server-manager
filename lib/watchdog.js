const { getPalworldApi, runNssm, isServiceRunning, getServiceName } = require('./palworldClient');
const discord = require('./discord');
const activityLog = require('./activityLog');

const FAIL_THRESHOLD = parseInt(process.env.WATCHDOG_FAIL_THRESHOLD || '3', 10);
const CHECK_INTERVAL_MS = parseInt(process.env.WATCHDOG_INTERVAL_MS || '60000', 10);

let consecutiveFailures = 0;
let restarting = false;

async function check() {
  if (restarting) return;

  const serviceRunning = await isServiceRunning();
  if (!serviceRunning) {
    // Service arrêté (via le dashboard ou manuellement) : rien d'anormal, pas d'action
    consecutiveFailures = 0;
    return;
  }

  try {
    const res = await getPalworldApi().get('/v1/api/info');
    consecutiveFailures = res.status === 200 ? 0 : consecutiveFailures + 1;
  } catch {
    consecutiveFailures++;
  }

  if (consecutiveFailures >= FAIL_THRESHOLD) {
    restarting = true;
    consecutiveFailures = 0;
    activityLog.log('watchdog', 'auto-restart', 'API injoignable alors que le service Windows est actif');
    await discord.notify('⚠️ Le serveur Palworld ne répond plus alors que le process tourne toujours — redémarrage automatique en cours…');
    try {
      await runNssm(['restart', getServiceName()]);
      await discord.notify('✅ Redémarrage automatique effectué.');
    } catch (err) {
      await discord.notify(`❌ Échec du redémarrage automatique : ${err}`);
    } finally {
      restarting = false;
    }
  }
}

function start() {
  setInterval(check, CHECK_INTERVAL_MS);
}

module.exports = { start };
