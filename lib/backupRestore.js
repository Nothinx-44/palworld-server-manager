const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { extractZip } = require('./download');

// Zippe savePath dans backupDir (même logique que makeBackup() de server.js) : utilisé ici pour
// prendre une sauvegarde de sécurité du monde actuel juste avant de l'écraser par une restauration.
function zipDirectory(sourceDir, destZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Restaure une sauvegarde .zip vers SAVE_PATH, en prenant d'abord une sauvegarde de sécurité du
// monde actuel (pour pouvoir annuler une restauration faite par erreur). L'appelant est
// responsable de vérifier que le serveur est éteint avant d'appeler cette fonction.
async function restoreBackup({ backupZipPath, savePath, backupDir }) {
  if (!fs.existsSync(backupZipPath)) throw new Error('backup_not_found');
  fs.mkdirSync(backupDir, { recursive: true });

  let safetyFilename = null;
  if (fs.existsSync(savePath) && fs.readdirSync(savePath).length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    safetyFilename = `pre-restore_${stamp}.zip`;
    await zipDirectory(savePath, path.join(backupDir, safetyFilename));
  }

  fs.rmSync(savePath, { recursive: true, force: true });
  fs.mkdirSync(savePath, { recursive: true });
  await extractZip(backupZipPath, savePath);

  return { safetyFilename };
}

module.exports = { restoreBackup, zipDirectory };
