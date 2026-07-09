const axios = require('axios');
const { version } = require('../package.json');

// Vérifie si une nouvelle version du dashboard est publiée sur le dépôt public GitHub
// (celui des releases, pas celui du code source). Résultat mis en cache 6h : inutile de
// marteler l'API GitHub (limitée à 60 requêtes/h sans authentification).
const RELEASES_REPO = 'Nothinx-44/palworld-launcher-server-manager';
const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`;
const CACHE_MS = 6 * 60 * 60 * 1000;
let cache = { at: 0, result: null };

function isNewer(latest, current) {
  const a = String(latest).split('.').map(n => parseInt(n, 10) || 0);
  const b = String(current).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

async function check() {
  if (cache.result && Date.now() - cache.at < CACHE_MS) return cache.result;
  let result;
  try {
    const res = await axios.get(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, { timeout: 8000 });
    const latest = String(res.data.tag_name || '').replace(/^v/, '');
    result = {
      current: version,
      latest: latest || null,
      updateAvailable: !!latest && isNewer(latest, version),
      url: res.data.html_url || RELEASES_PAGE
    };
  } catch {
    // GitHub injoignable (pas d'internet, quota API...) : pas de notification, on réessaiera
    result = { current: version, latest: null, updateAvailable: false, url: RELEASES_PAGE };
  }
  cache = { at: Date.now(), result };
  return result;
}

module.exports = { check, isNewer };
