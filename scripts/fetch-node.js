// Récupère un node.exe autonome (Windows x64) et le place dans runtime/, pour qu'il soit embarqué
// dans l'.exe portable. C'est ce node.exe qui fera tourner le service dashboard côté utilisateur,
// sans qu'il ait à installer Node lui-même. Lancé automatiquement par `npm run dist`.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { downloadFile, extractZip } = require('../lib/download');

const NODE_VERSION = process.env.BUNDLE_NODE_VERSION || 'v20.18.1'; // LTS, suffisant pour le dashboard
const URL = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`;
const RUNTIME_DIR = path.join(__dirname, '..', 'runtime');
const DEST_EXE = path.join(RUNTIME_DIR, 'node.exe');

async function main() {
  if (fs.existsSync(DEST_EXE)) {
    console.log('runtime/node.exe déjà présent, rien à faire.');
    return;
  }
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'node-dl-'));
  const zip = path.join(tmp, 'node.zip');

  console.log(`Téléchargement de Node ${NODE_VERSION} (Windows x64)…`);
  await downloadFile(URL, zip);
  await extractZip(zip, tmp);

  const extractedExe = path.join(tmp, `node-${NODE_VERSION}-win-x64`, 'node.exe');
  if (!fs.existsSync(extractedExe)) throw new Error('node.exe introuvable après extraction.');
  fs.copyFileSync(extractedExe, DEST_EXE);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`runtime/node.exe prêt (${NODE_VERSION}).`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
