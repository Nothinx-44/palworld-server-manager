const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE_FILE = path.join(__dirname, '..', '.env.example');

// Met à jour (ou crée) une clé=valeur dans le fichier .env en préservant le reste du fichier
// (commentaires, ordre), puis applique le changement à process.env pour un effet immédiat
// sans redémarrer le dashboard.
function updateEnvFile(updates) {
  const basePath = fs.existsSync(ENV_FILE) ? ENV_FILE : ENV_EXAMPLE_FILE;
  let lines = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf-8').split(/\r?\n/) : [];

  Object.entries(updates).forEach(([key, value]) => {
    const linePattern = new RegExp(`^${key}=.*$`);
    const newLine = `${key}=${value}`;
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
