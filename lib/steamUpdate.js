const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const APP_ID = '2394010';

// Build actuellement installé, lu dans le manifeste Steam local (steamapps/appmanifest_XXX.acf).
function getInstalledBuildId() {
  const installDir = process.env.PALWORLD_INSTALL_DIR || '';
  if (!installDir) return null;
  const manifest = path.join(installDir, 'steamapps', `appmanifest_${APP_ID}.acf`);
  if (!fs.existsSync(manifest)) return null;
  const m = fs.readFileSync(manifest, 'utf-8').match(/"buildid"\s*"(\d+)"/);
  return m ? m[1] : null;
}

// Extrait le buildid de la branche publique depuis la sortie VDF de `app_info_print`.
function parseLatestBuildId(output) {
  const m = String(output).match(/"public"\s*\{[\s\S]*?"buildid"\s*"(\d+)"/);
  return m ? m[1] : null;
}

// Dernier build publié sur Steam, interrogé via SteamCMD (peut prendre 30-60 s : SteamCMD
// démarre, se connecte en anonyme et rafraîchit les infos de l'app).
function getLatestBuildId() {
  return new Promise((resolve, reject) => {
    const steamCmdPath = process.env.STEAMCMD_PATH || '';
    if (!steamCmdPath) return reject(new Error('STEAMCMD_PATH non configuré dans .env'));
    execFile(
      steamCmdPath,
      ['+login', 'anonymous', '+app_info_update', '1', '+app_info_print', APP_ID, '+quit'],
      { timeout: 3 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout) => {
        // SteamCMD peut sortir avec un code non nul tout en ayant imprimé les infos : on juge
        // sur le contenu, pas sur le code de sortie.
        const build = parseLatestBuildId(stdout || '');
        if (build) return resolve(build);
        reject(error ? new Error(String(error.message || error)) : new Error('buildid introuvable dans la sortie SteamCMD'));
      }
    );
  });
}

async function checkForUpdate() {
  const installedBuild = getInstalledBuildId();
  const latestBuild = await getLatestBuildId();
  return {
    installedBuild,
    latestBuild,
    updateAvailable: !!installedBuild && !!latestBuild && installedBuild !== latestBuild
  };
}

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

module.exports = { runUpdate, checkForUpdate, getInstalledBuildId, getLatestBuildId, parseLatestBuildId };
