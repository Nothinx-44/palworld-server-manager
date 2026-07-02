const fs = require('fs');
const path = require('path');
const { downloadFile, extractZip } = require('./download');
const { getNssmPath } = require('./palworldClient');
const { updateEnvFile } = require('./envFile');
const { HOME } = require('./paths');

// Archive officielle NSSM (contient nssm-2.24/win64/nssm.exe et win32/nssm.exe).
const NSSM_ZIP_URL = 'https://nssm.cc/release/nssm-2.24.zip';

// Cherche win64/nssm.exe (ou win32 en secours) dans le dossier extrait, quel que soit le nom
// du sous-dossier versionné.
function findNssmExe(dir) {
  if (!fs.existsSync(dir)) return null;
  const arches = process.arch === 'x64' ? ['win64', 'win32'] : ['win32', 'win64'];
  const subdirs = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory());
  for (const arch of arches) {
    for (const sub of subdirs) {
      const candidate = path.join(dir, sub.name, arch, 'nssm.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// Garantit qu'un nssm.exe utilisable est disponible. Si NSSM_PATH pointe déjà sur un fichier
// existant, on ne touche à rien. Sinon on télécharge NSSM dans le dossier de base et on renseigne
// NSSM_PATH (process.env + .env) pour tout le reste de l'application — c'est ce qui rend l'.exe
// « zéro prérequis » : l'utilisateur n'a rien à télécharger à la main.
async function ensureNssm(onLog = () => {}) {
  const current = getNssmPath();
  if (current && current.toLowerCase() !== 'nssm.exe' && fs.existsSync(current)) {
    onLog('NSSM déjà présent, ok.');
    return current;
  }

  const nssmDir = path.join(HOME, 'nssm');
  let exe = findNssmExe(nssmDir);
  if (exe) {
    onLog('NSSM déjà téléchargé, ok.');
  } else {
    onLog('Téléchargement de NSSM…');
    fs.mkdirSync(nssmDir, { recursive: true });
    const zipPath = path.join(nssmDir, 'nssm.zip');
    await downloadFile(NSSM_ZIP_URL, zipPath);
    await extractZip(zipPath, nssmDir);
    fs.unlinkSync(zipPath);
    exe = findNssmExe(nssmDir);
    if (!exe) throw new Error('nssm.exe introuvable après extraction.');
    onLog('NSSM installé.');
  }

  updateEnvFile({ NSSM_PATH: exe });
  return exe;
}

module.exports = { ensureNssm, findNssmExe, NSSM_ZIP_URL };
