const fs = require('fs');
const https = require('https');
const { execFile } = require('child_process');

// Télécharge un fichier en suivant les redirections HTTP (SteamCMD et NSSM en utilisent).
// Le timeout porte sur l'inactivité du socket (aucune donnée reçue), pas sur la durée totale :
// un gros téléchargement actif n'est jamais coupé, mais une connexion qui stall ne fige plus
// l'installation indéfiniment.
const IDLE_TIMEOUT_MS = 60000;

function downloadFile(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: IDLE_TIMEOUT_MS }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(downloadFile(res.headers.location, destPath, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Téléchargement échoué (HTTP ${res.statusCode})`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', err => { file.close(); reject(err); });
    });
    req.on('timeout', () => req.destroy(new Error(`Téléchargement bloqué (aucune donnée reçue depuis ${IDLE_TIMEOUT_MS / 1000} s)`)));
    req.on('error', reject);
  });
}

// Décompresse un .zip via PowerShell (présent nativement sur Windows, pas de dépendance en plus).
// Chemins en quotes simples PowerShell (les ' doublés) : jamais interprétés, contrairement aux
// quotes doubles où un nom de fichier contenant $(...) serait exécuté comme du code.
function psQuote(str) {
  return `'${String(str).replace(/'/g, "''")}'`;
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(destDir)} -Force`], (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve();
    });
  });
}

module.exports = { downloadFile, extractZip };
