const { execFile } = require('child_process');

const APP_ID = '2394010';

// Lance une vérification/mise à jour SteamCMD (no-op si déjà à jour, "validate" corrige
// aussi les fichiers corrompus). Peut prendre de quelques secondes à plusieurs minutes
// selon si une mise à jour est disponible.
function runUpdate() {
  return new Promise((resolve, reject) => {
    const steamCmdPath = process.env.STEAMCMD_PATH || '';
    const installDir = process.env.PALWORLD_INSTALL_DIR || '';
    if (!steamCmdPath || !installDir) {
      return reject(new Error('STEAMCMD_PATH ou PALWORLD_INSTALL_DIR non configuré dans .env'));
    }
    execFile(
      steamCmdPath,
      ['+force_install_dir', installDir, '+login', 'anonymous', '+app_update', APP_ID, 'validate', '+quit'],
      { timeout: 15 * 60 * 1000 }, // 15 min max, une grosse maj peut prendre du temps
      (error, stdout, stderr) => {
        if (error) return reject(stderr || error.message);
        const updated = /Success! App '2394010' fully installed/i.test(stdout) || /downloading/i.test(stdout);
        resolve({ stdout, updated });
      }
    );
  });
}

module.exports = { runUpdate };
