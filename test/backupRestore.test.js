const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { restoreBackup, zipDirectory } = require('../lib/backupRestore');

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('restoreBackup remplace le contenu de savePath par celui du zip', async () => {
  const savePath = mkTmp('palworld-restore-save-');
  const backupDir = mkTmp('palworld-restore-backup-');
  const sourceDir = mkTmp('palworld-restore-source-'); // contenu "de la sauvegarde" à restaurer

  fs.writeFileSync(path.join(savePath, 'ancien.sav'), 'ancien contenu');
  fs.writeFileSync(path.join(sourceDir, 'Level.sav'), 'nouveau contenu');
  fs.mkdirSync(path.join(sourceDir, 'Players'));
  fs.writeFileSync(path.join(sourceDir, 'Players', 'joueur1.sav'), 'joueur');

  const zipPath = path.join(backupDir, 'backup_test.zip');
  await zipDirectory(sourceDir, zipPath);

  const result = await restoreBackup({ backupZipPath: zipPath, savePath, backupDir });

  assert.ok(result.safetyFilename, 'une sauvegarde de sécurité doit être créée (savePath non vide avant)');
  assert.ok(fs.existsSync(path.join(backupDir, result.safetyFilename)));
  assert.ok(fs.existsSync(path.join(savePath, 'Level.sav')));
  assert.ok(fs.existsSync(path.join(savePath, 'Players', 'joueur1.sav')));
  assert.strictEqual(fs.existsSync(path.join(savePath, 'ancien.sav')), false, 'l\'ancien contenu doit être remplacé');
});

test('restoreBackup ne crée pas de sauvegarde de sécurité si savePath est vide/absent', async () => {
  const savePath = path.join(mkTmp('palworld-restore-save2-'), 'inexistant');
  const backupDir = mkTmp('palworld-restore-backup2-');
  const sourceDir = mkTmp('palworld-restore-source2-');
  fs.writeFileSync(path.join(sourceDir, 'Level.sav'), 'contenu');

  const zipPath = path.join(backupDir, 'backup_test.zip');
  await zipDirectory(sourceDir, zipPath);

  const result = await restoreBackup({ backupZipPath: zipPath, savePath, backupDir });
  assert.strictEqual(result.safetyFilename, null);
  assert.ok(fs.existsSync(path.join(savePath, 'Level.sav')));
});

test('restoreBackup rejette si le fichier zip est introuvable', async () => {
  const savePath = mkTmp('palworld-restore-save3-');
  const backupDir = mkTmp('palworld-restore-backup3-');
  await assert.rejects(
    restoreBackup({ backupZipPath: path.join(backupDir, 'inexistant.zip'), savePath, backupDir }),
    /backup_not_found/
  );
});
