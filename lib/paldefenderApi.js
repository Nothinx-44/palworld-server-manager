const axios = require('axios');

// Client pour l'API REST propre à PalDefender (distincte de l'API officielle Palworld) :
// http://127.0.0.1:17993/v1/pdapi/..., authentification par jeton Bearer. Voir
// lib/plugins.js#configurePalDefenderApi pour comment le jeton est généré/activé.
function client() {
  return axios.create({
    baseURL: process.env.PALDEFENDER_API_URL || 'http://127.0.0.1:17993',
    headers: { Authorization: `Bearer ${process.env.PALDEFENDER_API_TOKEN || ''}` },
    timeout: 8000,
    validateStatus: () => true
  });
}

async function call(method, path, body) {
  if (!process.env.PALDEFENDER_API_TOKEN) throw new Error('paldefender_not_configured');
  const res = await client().request({ method, url: path, data: body });
  if (res.status === 401) throw new Error('paldefender_invalid_token');
  if (res.status >= 400) throw new Error((res.data && res.data.Error && res.data.Error.Message) || `Erreur PalDefender (HTTP ${res.status})`);
  return res.data;
}

// Commandes "principales" exposées par l'onglet Tableau de bord (le reste — items/pals/tech —
// nécessiterait une base d'identifiants d'objets que ce dashboard n'a pas).
const COMMANDS = {
  kick: { label: 'Kick', needsPlayer: true, fields: ['Reason'], run: (id, f) => call('post', `/v1/pdapi/kick/${encodeURIComponent(id)}`, { Reason: f.Reason || undefined }) },
  ban: { label: 'Ban', needsPlayer: true, fields: ['Reason', 'IP'], run: (id, f) => call('post', `/v1/pdapi/ban/${encodeURIComponent(id)}`, { Reason: f.Reason || undefined, IP: !!f.IP }) },
  unban: { label: 'Débannir', needsPlayer: true, fields: ['Reason'], run: (id, f) => call('post', `/v1/pdapi/unban/${encodeURIComponent(id)}`, { Reason: f.Reason || undefined }) },
  banip: { label: 'Bannir une IP', needsIp: true, fields: ['Reason'], run: (ip, f) => call('post', `/v1/pdapi/banip/${encodeURIComponent(ip)}`, { Reason: f.Reason || undefined }) },
  unbanip: { label: 'Débannir une IP', needsIp: true, fields: ['Reason'], run: (ip, f) => call('post', `/v1/pdapi/unbanip/${encodeURIComponent(ip)}`, { Reason: f.Reason || undefined }) },
  broadcast: { label: 'Annonce (Broadcast)', fields: ['Message', 'Sender'], run: (_id, f) => call('post', '/v1/pdapi/Broadcast', { Message: f.Message, Sender: f.Sender || undefined }) },
  alert: { label: 'Alerte', fields: ['Message'], run: (_id, f) => call('post', '/v1/pdapi/Alert', { Message: f.Message }) },
  message: {
    label: 'Message à un joueur', needsPlayer: true, fields: ['Message', 'SendType'],
    run: (id, f) => call('post', '/v1/pdapi/SendPlayerMessage', { SendType: f.SendType || 'PlayerChat', UserID: id, Message: f.Message })
  }
};

module.exports = { COMMANDS, call };
