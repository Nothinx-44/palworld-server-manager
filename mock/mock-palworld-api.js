// Simule l'API REST de Palworld (port 8212) pour tester le dashboard sans vrai serveur de jeu.
// Usage : node mock/mock-palworld-api.js
// Puis lance le dashboard normalement (node server.js) en pointant PALWORLD_API_URL dessus.
require('dotenv').config({ path: require('../lib/paths').ENV_FILE });
const express = require('express');
const app = express();
app.use(express.json());

const MOCK_PORT = process.env.MOCK_PORT || 8212;
const API_USER = process.env.PALWORLD_API_USER || 'admin';
const API_PASSWORD = process.env.PALWORLD_API_PASSWORD || 'testpass';

const START_TIME = Date.now();
let banned = [];

// Quelques joueurs fictifs pour avoir quelque chose à afficher (location_x/y en unités Unreal,
// comme le vrai serveur, pour tester la future carte).
let players = [
  { name: 'Copain1', accountName: 'copain1#1234', playerId: '1', userId: 'user-001', ip: '82.12.34.56', ping: 42, level: 23, building_count: 12, location_x: 123456.7, location_y: -45678.9 },
  { name: 'Copain2', accountName: 'copain2#5678', playerId: '2', userId: 'user-002', ip: '90.45.67.89', ping: 67, level: 8, building_count: 3, location_x: -234567.1, location_y: 98765.4 }
];

function checkAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const expected = 'Basic ' + Buffer.from(`${API_USER}:${API_PASSWORD}`).toString('base64');
  if (header !== expected) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.use(checkAuth);

app.get('/v1/api/info', (req, res) => {
  res.json({ servername: 'Serveur de test (mock)', version: '0.0.0-mock', description: 'Faux serveur pour tester le dashboard' });
});

app.get('/v1/api/players', (req, res) => {
  // Petite marche aléatoire pour voir les joueurs bouger sur la carte du dashboard
  players.forEach(p => {
    p.location_x += (Math.random() - 0.5) * 8000;
    p.location_y += (Math.random() - 0.5) * 8000;
  });
  res.json({ players });
});

app.get('/v1/api/metrics', (req, res) => {
  res.json({
    serverfps: 58,
    currentplayernum: players.length,
    serverframetime: 17.1,
    maxplayernum: 32,
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    days: 3
  });
});

app.get('/v1/api/settings', (req, res) => {
  res.json({
    ServerName: 'Serveur de test (mock)',
    Difficulty: 'None',
    DayTimeSpeedRate: 1,
    NightTimeSpeedRate: 1,
    ExpRate: 1.5,
    PalCaptureRate: 1,
    PalSpawnNumRate: 1,
    DeathPenalty: 'All',
    bEnablePlayerToPlayerDamage: false,
    bEnablePvP: false,
    bEnableInvaderEnemy: true,
    ServerPlayerMaxNum: 32,
    bIsMultiplay: true
  });
});

app.post('/v1/api/ban', (req, res) => {
  banned.push(req.body.userid);
  players = players.filter(p => p.userId !== req.body.userid); // bannir déconnecte le joueur
  console.log('[mock] Ban de', req.body.userid);
  res.json({ message: 'ok' });
});

app.post('/v1/api/unban', (req, res) => {
  banned = banned.filter(u => u !== req.body.userid);
  console.log('[mock] Unban de', req.body.userid);
  res.json({ message: 'ok' });
});

app.post('/v1/api/stop', (req, res) => {
  console.log('[mock] Force stop demandé');
  res.json({ message: 'ok' });
});

app.post('/v1/api/save', (req, res) => {
  console.log('[mock] Sauvegarde demandée');
  res.json({ message: 'ok' });
});

app.post('/v1/api/shutdown', (req, res) => {
  console.log('[mock] Arrêt demandé :', req.body);
  res.json({ message: 'ok' });
});

app.post('/v1/api/announce', (req, res) => {
  console.log('[mock] Annonce :', req.body.message);
  res.json({ message: 'ok' });
});

app.post('/v1/api/kick', (req, res) => {
  const before = players.length;
  players = players.filter(p => p.userId !== req.body.userid);
  console.log(`[mock] Kick de ${req.body.userid} (${before} -> ${players.length} joueurs)`);
  res.json({ message: 'ok' });
});

// Route de confort pour simuler une connexion/déconnexion pendant le test
app.post('/mock/toggle-player', (req, res) => {
  if (players.find(p => p.userId === 'user-003')) {
    players = players.filter(p => p.userId !== 'user-003');
  } else {
    players.push({ name: 'Copain3', accountName: 'copain3#0000', playerId: '3', userId: 'user-003', ip: '11.22.33.44', ping: 55, level: 15, building_count: 1 });
  }
  res.json({ players });
});

app.listen(MOCK_PORT, () => {
  console.log(`Mock API Palworld démarré sur le port ${MOCK_PORT} (user: ${API_USER})`);
});
