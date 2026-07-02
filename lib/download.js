const fs = require('fs');
const https = require('https');
const { execFile } = require('child_process');

// Télécharge un fichier en suivant les redirections HTTP (SteamCMD et NSSM en utilisent).
function downloadFile(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
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
      file.on('error', reject);
    }).on('error', reject);
  });
}

// Décompresse un .zip via PowerShell (présent nativement sur Windows, pas de dépendance en plus).
function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`], (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve();
    });
  });
}

module.exports = { downloadFile, extractZip };
