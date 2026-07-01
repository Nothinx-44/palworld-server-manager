// Usage : node scripts/create-user.js <username> <password> [admin|viewer]
// Utile pour créer le tout premier compte admin, ou récupérer l'accès si tu es bloqué dehors.
// Une fois connecté, la gestion des comptes se fait normalement depuis le dashboard.
require('dotenv').config();
const users = require('../lib/users');

const [, , username, password, roleArg] = process.argv;
if (!username || !password) {
  console.log('Usage : node scripts/create-user.js <username> <password> [admin|viewer]');
  process.exit(1);
}

const role = roleArg === 'viewer' ? 'viewer' : 'admin';
const existed = !!users.findUser(username);
users.upsertUser(username, password, role);
console.log(existed
  ? `Utilisateur "${username}" mis à jour (rôle : ${role}).`
  : `Utilisateur "${username}" créé (rôle : ${role}).`);
