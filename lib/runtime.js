const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Fichiers/dossiers du dashboard à recopier vers l'emplacement stable du service.
// (node_modules est déjà « pruné » des devDeps par electron-builder dans le build packagé.)
const RUNTIME_ITEMS = ['server.js', 'package.json', '.env.example', 'lib', 'public', 'node_modules', 'runtime'];

// Résout un node.exe utilisable pour faire tourner le service dashboard :
// 1) le node.exe embarqué dans runtime/ (mode packagé — c'est ce qui assure le « zéro prérequis ») ;
// 2) sinon le node du PATH (mode développement), localisé via `where`.
function resolveNodeExe(appDir) {
  const bundled = path.join(appDir, 'runtime', 'node.exe');
  if (fs.existsSync(bundled)) return Promise.resolve(bundled);
  return new Promise((resolve, reject) => {
    execFile('where', ['node'], (err, stdout) => {
      if (err) return reject(new Error('node.exe introuvable (ni embarqué dans runtime/, ni dans le PATH).'));
      const first = String(stdout).split(/\r?\n/).map(s => s.trim()).find(Boolean);
      if (!first) return reject(new Error('node.exe introuvable dans le PATH.'));
      resolve(first);
    });
  });
}

// Prépare un emplacement stable et autonome pour le service dashboard, indépendant du dossier
// temporaire dans lequel un .exe portable est extrait à l'exécution. En mode packagé on copie les
// fichiers du dashboard vers HOME/app ; en développement on tourne directement sur le projet.
async function materializeRuntime({ appRoot, home, packaged }, onLog = () => {}) {
  let appDir;
  if (packaged) {
    appDir = path.join(home, 'app');
    onLog('Copie du dashboard vers un emplacement stable…');
    fs.mkdirSync(appDir, { recursive: true });
    for (const item of RUNTIME_ITEMS) {
      const src = path.join(appRoot, item);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(appDir, item), { recursive: true });
    }
  } else {
    appDir = appRoot; // dev : on tourne sur place, pas de copie
  }
  const nodeExe = await resolveNodeExe(appDir);
  return { appDir, nodeExe, serverJs: path.join(appDir, 'server.js') };
}

module.exports = { materializeRuntime, resolveNodeExe, RUNTIME_ITEMS };
