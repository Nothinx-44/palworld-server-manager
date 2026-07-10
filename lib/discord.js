const axios = require('axios');

// Catégories d'événements notifiables, affichées comme cases à cocher dans le dashboard
// (Réglages → Notifications Discord). Activées par défaut (DISCORD_NOTIFY_<CAT> absent = activé)
// pour que les installations existantes continuent de tout recevoir sans configuration
// supplémentaire ; seule une case explicitement décochée désactive sa catégorie.
const CATEGORIES = {
  server: 'Démarrage / arrêt / redémarrage du serveur',
  players: 'Joueurs qui rejoignent / quittent',
  backups: 'Sauvegardes (manuelles, planifiées, restaurations)',
  updates: 'Mises à jour du serveur',
  admin: 'Actions admin (bans, kicks, réglages, plugins)',
  disk: 'Espace disque faible',
  restart: 'Redémarrages programmés (avertissements)'
};

// Messages Discord, indépendants de la langue du navigateur (c'est un webhook serveur, pas une
// session utilisateur) : la langue se choisit une fois pour toutes dans les Réglages du dashboard
// (DISCORD_LANG, "fr" par défaut). Chaque entrée est une fonction (params) -> texte, par langue.
const MESSAGES = {
  setupStart: {
    fr: p => `🛠️ Installation du serveur Palworld lancée par **${p.user}**…`,
    en: p => `🛠️ Palworld server installation started by **${p.user}**…`
  },
  setupDone: {
    fr: () => '✅ Installation du serveur Palworld terminée, le dashboard est prêt à le gérer.',
    en: () => '✅ Palworld server installation complete, the dashboard is ready to manage it.'
  },
  setupError: {
    fr: p => `❌ Échec de l'installation du serveur Palworld : ${p.error}`,
    en: p => `❌ Palworld server installation failed: ${p.error}`
  },
  settingsChanged: {
    fr: p => `⚙️ Réglages du monde modifiés par **${p.user}** : ${p.keys}`,
    en: p => `⚙️ World settings changed by **${p.user}**: ${p.keys}`
  },
  serverUpdated: {
    fr: () => '⬆️ Le serveur a été mis à jour vers la dernière version.',
    en: () => '⬆️ The server has been updated to the latest version.'
  },
  updateCheckFailed: {
    fr: p => `⚠️ Vérification de mise à jour échouée, redémarrage sans update (${p.error})`,
    en: p => `⚠️ Update check failed, restarting without updating (${p.error})`
  },
  started: {
    fr: p => `▶️ Serveur démarré par **${p.user}**`,
    en: p => `▶️ Server started by **${p.user}**`
  },
  stopRequested: {
    fr: p => `⏹️ Arrêt du serveur demandé par **${p.user}**`,
    en: p => `⏹️ Server stop requested by **${p.user}**`
  },
  stopForcedApiUnreachable: {
    fr: p => `⏹️ Arrêt forcé du serveur par **${p.user}** (API injoignable)`,
    en: p => `⏹️ Server force-stopped by **${p.user}** (API unreachable)`
  },
  restartRequested: {
    fr: p => `🔄 Redémarrage demandé par **${p.user}** (vérification de mise à jour incluse)…`,
    en: p => `🔄 Restart requested by **${p.user}** (includes an update check)…`
  },
  playerKicked: {
    fr: p => `👢 Joueur exclu par **${p.user}**`,
    en: p => `👢 Player kicked by **${p.user}**`
  },
  playerBanned: {
    fr: p => `🔨 **${p.name}** banni par **${p.user}**`,
    en: p => `🔨 **${p.name}** banned by **${p.user}**`
  },
  unbanned: {
    fr: p => `♻️ ${p.ip ? 'IP débannie' : 'Joueur débanni'} par **${p.user}**`,
    en: p => `♻️ ${p.ip ? 'IP unbanned' : 'Player unbanned'} by **${p.user}**`
  },
  forceStopImmediate: {
    fr: p => `🛑 Arrêt forcé (immédiat) du serveur par **${p.user}**`,
    en: p => `🛑 Server force-stopped (immediate) by **${p.user}**`
  },
  updateLaunched: {
    fr: p => `⬆️ Mise à jour du serveur lancée par **${p.user}**…`,
    en: p => `⬆️ Server update started by **${p.user}**…`
  },
  updateDoneStopped: {
    fr: () => '⬆️ Mise à jour terminée (serveur laissé arrêté).',
    en: () => '⬆️ Update complete (server left stopped).'
  },
  updateFailed: {
    fr: p => `❌ Échec de la mise à jour : ${p.error}`,
    en: p => `❌ Update failed: ${p.error}`
  },
  restartScheduled: {
    fr: p => `🕒 Redémarrage programmé dans ${p.minutes} min par **${p.user}**`,
    en: p => `🕒 Restart scheduled in ${p.minutes} min by **${p.user}**`
  },
  restartCancelled: {
    fr: p => `✅ Redémarrage programmé annulé par **${p.user}**`,
    en: p => `✅ Scheduled restart cancelled by **${p.user}**`
  },
  manualBackup: {
    fr: p => `💾 Sauvegarde manuelle effectuée par **${p.user}**`,
    en: p => `💾 Manual backup done by **${p.user}**`
  },
  manualBackupFailed: {
    fr: p => `❌ Échec de la sauvegarde manuelle : ${p.error}`,
    en: p => `❌ Manual backup failed: ${p.error}`
  },
  backupRestored: {
    fr: p => `♻️ Sauvegarde **${p.filename}** restaurée par **${p.user}**${p.safetyFilename ? ` (monde précédent conservé dans ${p.safetyFilename})` : ''}`,
    en: p => `♻️ Backup **${p.filename}** restored by **${p.user}**${p.safetyFilename ? ` (previous world kept as ${p.safetyFilename})` : ''}`
  },
  pluginInstalled: {
    fr: p => `🧩 **${p.label} ${p.version}** installé par **${p.user}**`,
    en: p => `🧩 **${p.label} ${p.version}** installed by **${p.user}**`
  },
  test: {
    fr: p => `✅ Test réussi ! Les notifications Discord sont bien configurées pour **${p.user}**.`,
    en: p => `✅ Test successful! Discord notifications are correctly configured for **${p.user}**.`
  },
  scheduledBackupFailed: {
    fr: p => `❌ Sauvegarde planifiée échouée : ${p.error}`,
    en: p => `❌ Scheduled backup failed: ${p.error}`
  },
  autoRestartScheduled: {
    fr: p => `🕒 Redémarrage automatique programmé dans ${p.minutes} min…`,
    en: p => `🕒 Automatic restart scheduled in ${p.minutes} min…`
  },
  diskLow: {
    fr: p => `⚠️ Espace disque faible sur \`${p.dir}\` : ${p.freeMb} Mo restants (seuil ${p.thresholdMb} Mo).`,
    en: p => `⚠️ Low disk space on \`${p.dir}\`: ${p.freeMb} MB left (threshold ${p.thresholdMb} MB).`
  },
  diskOk: {
    fr: p => `✅ Espace disque de nouveau suffisant sur \`${p.dir}\` (${p.freeMb} Mo).`,
    en: p => `✅ Disk space back to normal on \`${p.dir}\` (${p.freeMb} MB).`
  },
  playerJoin: {
    fr: p => `🟢 **${p.name}** a rejoint le serveur`,
    en: p => `🟢 **${p.name}** joined the server`
  },
  playerLeave: {
    fr: p => `🔴 **${p.name}** a quitté le serveur (${p.minutes} min de jeu)`,
    en: p => `🔴 **${p.name}** left the server (${p.minutes} min played)`
  },
  watchdogTriggered: {
    fr: () => '⚠️ Le serveur Palworld ne répond plus alors que le process tourne toujours — redémarrage automatique en cours…',
    en: () => '⚠️ The Palworld server is not responding even though the process is still running — automatic restart in progress…'
  },
  watchdogRestartDone: {
    fr: () => '✅ Redémarrage automatique effectué.',
    en: () => '✅ Automatic restart complete.'
  },
  watchdogRestartFailed: {
    fr: p => `❌ Échec du redémarrage automatique : ${p.error}`,
    en: p => `❌ Automatic restart failed: ${p.error}`
  }
};

function categoryEnabled(category) {
  if (!category || !CATEGORIES[category]) return true;
  return process.env[`DISCORD_NOTIFY_${category.toUpperCase()}`] !== 'false';
}

function getLang() {
  return process.env.DISCORD_LANG === 'en' ? 'en' : 'fr';
}

function buildMessage(key, params) {
  const tpl = MESSAGES[key];
  if (!tpl) throw new Error(`Clé de message Discord inconnue : ${key}`);
  const lang = getLang();
  return (tpl[lang] || tpl.fr)(params);
}

// Renvoie true si le message a bien été accepté par Discord (utilisé par le bouton
// "Envoyer un message de test" pour signaler une URL de webhook morte).
async function notify(key, params = {}, category) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false; // pas configuré, on ignore silencieusement
  if (!categoryEnabled(category)) return false; // catégorie désactivée par l'utilisateur
  try {
    await axios.post(webhookUrl, { content: buildMessage(key, params) });
    return true;
  } catch (err) {
    console.error('Notification Discord échouée:', err.message);
    return false;
  }
}

module.exports = { notify, CATEGORIES, MESSAGES, getLang };
