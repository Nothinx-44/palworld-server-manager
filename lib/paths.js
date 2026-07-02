const path = require('path');

// Racine inscriptible du dashboard : `.env` et `data/` y sont stockés.
// PALWORLD_DASHBOARD_HOME permet à l'app desktop et au service dashboard de partager le même
// dossier, hors du dossier de resources de l'.exe packagé (souvent en lecture seule).
// À défaut, on retombe sur la racine du projet — comportement historique inchangé.
const HOME = process.env.PALWORLD_DASHBOARD_HOME || path.join(__dirname, '..');

// DATA_DIR reste surchargeable indépendamment (utilisé tel quel par les tests).
const DATA_DIR = process.env.DATA_DIR || path.join(HOME, 'data');

const ENV_FILE = path.join(HOME, '.env');
const ENV_EXAMPLE_FILE = path.join(__dirname, '..', '.env.example');

module.exports = { HOME, DATA_DIR, ENV_FILE, ENV_EXAMPLE_FILE };
