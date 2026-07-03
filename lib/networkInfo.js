const os = require('os');
const axios = require('axios');

// IP locale (réseau domestique). Sur une machine avec plusieurs adaptateurs (VPN type Tailscale,
// réseaux virtuels Hyper-V/WSL...), la première IPv4 non-interne trouvée n'est souvent PAS le
// vrai réseau domestique : on préfère donc explicitement une IP privée de la plage 192.168.x.x
// (la plus courante en box/routeur grand public), avec repli sur les autres plages privées
// usuelles (10.x, 172.16-31.x) si aucune 192.168 n'existe, et en dernier recours la première
// IPv4 non-interne trouvée.
function getLocalIp() {
  const candidates = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net.address);
    }
  }
  const is192 = ip => ip.startsWith('192.168.');
  const is10 = ip => ip.startsWith('10.');
  const is172 = ip => /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  return candidates.find(is192) || candidates.find(is10) || candidates.find(is172) || candidates[0] || '127.0.0.1';
}

// IP publique de la box : interrogée via un service externe (le serveur ne la connaît pas
// lui-même), mise en cache pour ne pas refaire la requête à chaque appel — elle ne change
// quasiment jamais pour une IP fixe.
const CACHE_MS = 10 * 60 * 1000;
let cache = { ip: null, at: 0 };

async function getPublicIp() {
  if (cache.ip && Date.now() - cache.at < CACHE_MS) return cache.ip;
  try {
    const res = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    cache = { ip: res.data.ip, at: Date.now() };
    return cache.ip;
  } catch {
    return cache.ip; // dernière valeur connue si le service est injoignable, sinon null
  }
}

module.exports = { getLocalIp, getPublicIp };
