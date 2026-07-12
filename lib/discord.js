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
// (DISCORD_LANG : fr/en/zh/es, "fr" par défaut). Chaque entrée est une fonction (params) -> texte,
// par langue ; toute langue manquante retombe sur l'anglais puis le français.
const MESSAGES = {
  setupStart: {
    fr: p => `🛠️ Installation du serveur Palworld lancée par **${p.user}**…`,
    en: p => `🛠️ Palworld server installation started by **${p.user}**…`,
    zh: p => `🛠️ **${p.user}** 启动了 Palworld 服务器安装…`,
    es: p => `🛠️ Instalación del servidor de Palworld iniciada por **${p.user}**…`
  },
  setupDone: {
    fr: () => '✅ Installation du serveur Palworld terminée, le dashboard est prêt à le gérer.',
    en: () => '✅ Palworld server installation complete, the dashboard is ready to manage it.',
    zh: () => '✅ Palworld 服务器安装完成，仪表盘已准备好进行管理。',
    es: () => '✅ Instalación del servidor de Palworld completada, el panel está listo para gestionarlo.'
  },
  setupError: {
    fr: p => `❌ Échec de l'installation du serveur Palworld : ${p.error}`,
    en: p => `❌ Palworld server installation failed: ${p.error}`,
    zh: p => `❌ Palworld 服务器安装失败：${p.error}`,
    es: p => `❌ Error en la instalación del servidor de Palworld: ${p.error}`
  },
  settingsChanged: {
    fr: p => `⚙️ Réglages du monde modifiés par **${p.user}** : ${p.keys}`,
    en: p => `⚙️ World settings changed by **${p.user}**: ${p.keys}`,
    zh: p => `⚙️ **${p.user}** 修改了世界设置：${p.keys}`,
    es: p => `⚙️ Ajustes del mundo cambiados por **${p.user}**: ${p.keys}`
  },
  serverUpdated: {
    fr: () => '⬆️ Le serveur a été mis à jour vers la dernière version.',
    en: () => '⬆️ The server has been updated to the latest version.',
    zh: () => '⬆️ 服务器已更新到最新版本。',
    es: () => '⬆️ El servidor se ha actualizado a la última versión.'
  },
  updateCheckFailed: {
    fr: p => `⚠️ Vérification de mise à jour échouée, redémarrage sans update (${p.error})`,
    en: p => `⚠️ Update check failed, restarting without updating (${p.error})`,
    zh: p => `⚠️ 更新检查失败，跳过更新直接重启（${p.error}）`,
    es: p => `⚠️ Falló la comprobación de actualización, reiniciando sin actualizar (${p.error})`
  },
  started: {
    fr: p => `▶️ Serveur démarré par **${p.user}**`,
    en: p => `▶️ Server started by **${p.user}**`,
    zh: p => `▶️ **${p.user}** 启动了服务器`,
    es: p => `▶️ Servidor iniciado por **${p.user}**`
  },
  stopRequested: {
    fr: p => `⏹️ Arrêt du serveur demandé par **${p.user}**`,
    en: p => `⏹️ Server stop requested by **${p.user}**`,
    zh: p => `⏹️ **${p.user}** 请求停止服务器`,
    es: p => `⏹️ Parada del servidor solicitada por **${p.user}**`
  },
  stopForcedApiUnreachable: {
    fr: p => `⏹️ Arrêt forcé du serveur par **${p.user}** (API injoignable)`,
    en: p => `⏹️ Server force-stopped by **${p.user}** (API unreachable)`,
    zh: p => `⏹️ **${p.user}** 强制停止了服务器（API 无法访问）`,
    es: p => `⏹️ Servidor detenido a la fuerza por **${p.user}** (API inaccesible)`
  },
  restartRequested: {
    fr: p => `🔄 Redémarrage demandé par **${p.user}** (vérification de mise à jour incluse)…`,
    en: p => `🔄 Restart requested by **${p.user}** (includes an update check)…`,
    zh: p => `🔄 **${p.user}** 请求重启（含更新检查）…`,
    es: p => `🔄 Reinicio solicitado por **${p.user}** (incluye comprobación de actualización)…`
  },
  playerKicked: {
    fr: p => `👢 Joueur exclu par **${p.user}**`,
    en: p => `👢 Player kicked by **${p.user}**`,
    zh: p => `👢 **${p.user}** 踢出了一名玩家`,
    es: p => `👢 Jugador expulsado por **${p.user}**`
  },
  playerBanned: {
    fr: p => `🔨 **${p.name}** banni par **${p.user}**`,
    en: p => `🔨 **${p.name}** banned by **${p.user}**`,
    zh: p => `🔨 **${p.name}** 被 **${p.user}** 封禁`,
    es: p => `🔨 **${p.name}** baneado por **${p.user}**`
  },
  unbanned: {
    fr: p => `♻️ ${p.ip ? 'IP débannie' : 'Joueur débanni'} par **${p.user}**`,
    en: p => `♻️ ${p.ip ? 'IP unbanned' : 'Player unbanned'} by **${p.user}**`,
    zh: p => `♻️ **${p.user}** ${p.ip ? '解封了一个 IP' : '解封了一名玩家'}`,
    es: p => `♻️ ${p.ip ? 'IP desbaneada' : 'Jugador desbaneado'} por **${p.user}**`
  },
  forceStopImmediate: {
    fr: p => `🛑 Arrêt forcé (immédiat) du serveur par **${p.user}**`,
    en: p => `🛑 Server force-stopped (immediate) by **${p.user}**`,
    zh: p => `🛑 **${p.user}** 立即强制停止了服务器`,
    es: p => `🛑 Servidor detenido a la fuerza (inmediato) por **${p.user}**`
  },
  updateLaunched: {
    fr: p => `⬆️ Mise à jour du serveur lancée par **${p.user}**…`,
    en: p => `⬆️ Server update started by **${p.user}**…`,
    zh: p => `⬆️ **${p.user}** 启动了服务器更新…`,
    es: p => `⬆️ Actualización del servidor iniciada por **${p.user}**…`
  },
  updateDoneStopped: {
    fr: () => '⬆️ Mise à jour terminée (serveur laissé arrêté).',
    en: () => '⬆️ Update complete (server left stopped).',
    zh: () => '⬆️ 更新完成（服务器保持停止状态）。',
    es: () => '⬆️ Actualización completada (el servidor queda detenido).'
  },
  updateFailed: {
    fr: p => `❌ Échec de la mise à jour : ${p.error}`,
    en: p => `❌ Update failed: ${p.error}`,
    zh: p => `❌ 更新失败：${p.error}`,
    es: p => `❌ Error en la actualización: ${p.error}`
  },
  restartScheduled: {
    fr: p => `🕒 Redémarrage programmé dans ${p.minutes} min par **${p.user}**`,
    en: p => `🕒 Restart scheduled in ${p.minutes} min by **${p.user}**`,
    zh: p => `🕒 **${p.user}** 计划在 ${p.minutes} 分钟后重启`,
    es: p => `🕒 Reinicio programado en ${p.minutes} min por **${p.user}**`
  },
  restartCancelled: {
    fr: p => `✅ Redémarrage programmé annulé par **${p.user}**`,
    en: p => `✅ Scheduled restart cancelled by **${p.user}**`,
    zh: p => `✅ **${p.user}** 取消了计划的重启`,
    es: p => `✅ Reinicio programado cancelado por **${p.user}**`
  },
  manualBackup: {
    fr: p => `💾 Sauvegarde manuelle effectuée par **${p.user}**`,
    en: p => `💾 Manual backup done by **${p.user}**`,
    zh: p => `💾 **${p.user}** 完成了一次手动备份`,
    es: p => `💾 Copia manual realizada por **${p.user}**`
  },
  manualBackupFailed: {
    fr: p => `❌ Échec de la sauvegarde manuelle : ${p.error}`,
    en: p => `❌ Manual backup failed: ${p.error}`,
    zh: p => `❌ 手动备份失败：${p.error}`,
    es: p => `❌ Error en la copia manual: ${p.error}`
  },
  backupRestored: {
    fr: p => `♻️ Sauvegarde **${p.filename}** restaurée par **${p.user}**${p.safetyFilename ? ` (monde précédent conservé dans ${p.safetyFilename})` : ''}`,
    en: p => `♻️ Backup **${p.filename}** restored by **${p.user}**${p.safetyFilename ? ` (previous world kept as ${p.safetyFilename})` : ''}`,
    zh: p => `♻️ **${p.user}** 恢复了备份 **${p.filename}**${p.safetyFilename ? `（原世界已保存为 ${p.safetyFilename}）` : ''}`,
    es: p => `♻️ Copia **${p.filename}** restaurada por **${p.user}**${p.safetyFilename ? ` (mundo anterior guardado como ${p.safetyFilename})` : ''}`
  },
  pluginInstalled: {
    fr: p => `🧩 **${p.label} ${p.version}** installé par **${p.user}**`,
    en: p => `🧩 **${p.label} ${p.version}** installed by **${p.user}**`,
    zh: p => `🧩 **${p.user}** 安装了 **${p.label} ${p.version}**`,
    es: p => `🧩 **${p.label} ${p.version}** instalado por **${p.user}**`
  },
  test: {
    fr: p => `✅ Test réussi ! Les notifications Discord sont bien configurées pour **${p.user}**.`,
    en: p => `✅ Test successful! Discord notifications are correctly configured for **${p.user}**.`,
    zh: p => `✅ 测试成功！**${p.user}** 的 Discord 通知已正确配置。`,
    es: p => `✅ ¡Prueba superada! Las notificaciones de Discord están bien configuradas para **${p.user}**.`
  },
  scheduledBackupFailed: {
    fr: p => `❌ Sauvegarde planifiée échouée : ${p.error}`,
    en: p => `❌ Scheduled backup failed: ${p.error}`,
    zh: p => `❌ 计划备份失败：${p.error}`,
    es: p => `❌ Error en la copia programada: ${p.error}`
  },
  autoRestartScheduled: {
    fr: p => `🕒 Redémarrage automatique programmé dans ${p.minutes} min…`,
    en: p => `🕒 Automatic restart scheduled in ${p.minutes} min…`,
    zh: p => `🕒 计划在 ${p.minutes} 分钟后自动重启…`,
    es: p => `🕒 Reinicio automático programado en ${p.minutes} min…`
  },
  diskLow: {
    fr: p => `⚠️ Espace disque faible sur \`${p.dir}\` : ${p.freeMb} Mo restants (seuil ${p.thresholdMb} Mo).`,
    en: p => `⚠️ Low disk space on \`${p.dir}\`: ${p.freeMb} MB left (threshold ${p.thresholdMb} MB).`,
    zh: p => `⚠️ \`${p.dir}\` 磁盘空间不足：剩余 ${p.freeMb} MB（阈值 ${p.thresholdMb} MB）。`,
    es: p => `⚠️ Poco espacio en disco en \`${p.dir}\`: quedan ${p.freeMb} MB (umbral ${p.thresholdMb} MB).`
  },
  diskOk: {
    fr: p => `✅ Espace disque de nouveau suffisant sur \`${p.dir}\` (${p.freeMb} Mo).`,
    en: p => `✅ Disk space back to normal on \`${p.dir}\` (${p.freeMb} MB).`,
    zh: p => `✅ \`${p.dir}\` 磁盘空间恢复正常（${p.freeMb} MB）。`,
    es: p => `✅ Espacio en disco de nuevo suficiente en \`${p.dir}\` (${p.freeMb} MB).`
  },
  playerJoin: {
    fr: p => `🟢 **${p.name}** a rejoint le serveur`,
    en: p => `🟢 **${p.name}** joined the server`,
    zh: p => `🟢 **${p.name}** 加入了服务器`,
    es: p => `🟢 **${p.name}** se unió al servidor`
  },
  playerLeave: {
    fr: p => `🔴 **${p.name}** a quitté le serveur (${p.minutes} min de jeu)`,
    en: p => `🔴 **${p.name}** left the server (${p.minutes} min played)`,
    zh: p => `🔴 **${p.name}** 离开了服务器（游戏时长 ${p.minutes} 分钟）`,
    es: p => `🔴 **${p.name}** salió del servidor (${p.minutes} min jugados)`
  },
  watchdogTriggered: {
    fr: () => '⚠️ Le serveur Palworld ne répond plus alors que le process tourne toujours — redémarrage automatique en cours…',
    en: () => '⚠️ The Palworld server is not responding even though the process is still running — automatic restart in progress…',
    zh: () => '⚠️ Palworld 服务器无响应但进程仍在运行——正在自动重启…',
    es: () => '⚠️ El servidor de Palworld no responde aunque el proceso sigue en marcha: reinicio automático en curso…'
  },
  watchdogRestartDone: {
    fr: () => '✅ Redémarrage automatique effectué.',
    en: () => '✅ Automatic restart complete.',
    zh: () => '✅ 自动重启完成。',
    es: () => '✅ Reinicio automático completado.'
  },
  watchdogRestartFailed: {
    fr: p => `❌ Échec du redémarrage automatique : ${p.error}`,
    en: p => `❌ Automatic restart failed: ${p.error}`,
    zh: p => `❌ 自动重启失败：${p.error}`,
    es: p => `❌ Error en el reinicio automático: ${p.error}`
  }
};

const SUPPORTED_LANGS = ['fr', 'en', 'zh', 'es'];

function categoryEnabled(category) {
  if (!category || !CATEGORIES[category]) return true;
  return process.env[`DISCORD_NOTIFY_${category.toUpperCase()}`] !== 'false';
}

function getLang() {
  const lang = process.env.DISCORD_LANG;
  return SUPPORTED_LANGS.includes(lang) ? lang : 'fr';
}

function buildMessage(key, params) {
  const tpl = MESSAGES[key];
  if (!tpl) throw new Error(`Clé de message Discord inconnue : ${key}`);
  const lang = getLang();
  return (tpl[lang] || tpl.en || tpl.fr)(params);
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

module.exports = { notify, CATEGORIES, MESSAGES, getLang, SUPPORTED_LANGS };
