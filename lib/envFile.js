const fs = require('fs');
const { ENV_FILE, ENV_EXAMPLE_FILE } = require('./paths');

// dotenv traite un `#` non-quoté comme début de commentaire : une valeur qui en contient un
// (ex : mot de passe) serait silencieusement tronquée au prochain chargement. On la met donc
// entre guillemets dans ce cas — et uniquement dans ce cas, car dotenv applique l'expansion
// de `\n` dans les valeurs entre guillemets, ce qui corromprait un chemin Windows (D:\nom...).
function formatEnvValue(value) {
  const str = String(value);
  if (str.includes('#')) return `"${str.replace(/"/g, '')}"`;
  return str;
}

// Clés dont la valeur dans .env.example n'est qu'un exemple illustratif (chemin fictif, mot de
// passe bidon). Au premier amorçage du .env réel, on les vide : le dashboard signale alors
// clairement ce qui manque au lieu de faire semblant d'être configuré avec des valeurs fausses.
const PLACEHOLDER_KEYS = [
  'SESSION_SECRET', 'PALWORLD_API_PASSWORD', 'NSSM_PATH',
  'SAVE_PATH', 'BACKUP_DIR', 'STEAMCMD_PATH', 'PALWORLD_INSTALL_DIR'
];

// Met à jour (ou crée) une clé=valeur dans le fichier .env en préservant le reste du fichier
// (commentaires, ordre), puis applique le changement à process.env pour un effet immédiat
// sans redémarrer le dashboard.
function updateEnvFile(updates) {
  const seeding = !fs.existsSync(ENV_FILE);
  const basePath = seeding ? ENV_EXAMPLE_FILE : ENV_FILE;
  let lines = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf-8').split(/\r?\n/) : [];

  if (seeding) {
    lines = lines.map(line => {
      const m = line.match(/^([A-Z0-9_]+)=/);
      return m && PLACEHOLDER_KEYS.includes(m[1]) ? `${m[1]}=` : line;
    });
  }

  Object.entries(updates).forEach(([key, value]) => {
    const linePattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`);
    const newLine = `${key}=${formatEnvValue(value)}`;
    const index = lines.findIndex(line => linePattern.test(line));
    if (index >= 0) {
      lines[index] = newLine;
    } else {
      lines.push(newLine);
    }
    process.env[key] = value;
  });

  fs.writeFileSync(ENV_FILE, lines.join('\n'));
}

module.exports = { updateEnvFile, ENV_FILE };
