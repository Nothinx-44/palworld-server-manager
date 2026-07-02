const path = require('path');
const bcrypt = require('bcryptjs');
const { readJson, updateJsonSync } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
  return readJson(USERS_FILE, []);
}

function findUser(username) {
  return loadUsers().find(u => u.username === username);
}

// Liste sans les hash de mot de passe, pour affichage dans le dashboard
function listUsers() {
  return loadUsers().map(u => ({ username: u.username, role: u.role || 'admin' }));
}

function countAdmins(users = loadUsers()) {
  return users.filter(u => (u.role || 'admin') === 'admin').length;
}

// Toutes les mutations passent par updateJsonSync : lecture-modification-écriture sous verrou
// inter-process (le service dashboard et l'appli desktop peuvent écrire users.json tous les deux).

// Crée l'utilisateur s'il n'existe pas, ou met à jour mot de passe / rôle si fournis
function upsertUser(username, password, role) {
  updateJsonSync(USERS_FILE, [], users => {
    const existing = users.find(u => u.username === username);
    if (existing) {
      if (password) existing.passwordHash = bcrypt.hashSync(password, 10);
      if (role) existing.role = role;
    } else {
      if (!password) throw new Error('password_required');
      users.push({ username, passwordHash: bcrypt.hashSync(password, 10), role: role === 'viewer' ? 'viewer' : 'admin' });
    }
  });
}

function setRole(username, role) {
  updateJsonSync(USERS_FILE, [], users => {
    const target = users.find(u => u.username === username);
    if (!target) throw new Error('not_found');
    const currentRole = target.role || 'admin';
    if (currentRole === 'admin' && role !== 'admin' && countAdmins(users) <= 1) {
      throw new Error('last_admin');
    }
    target.role = role === 'viewer' ? 'viewer' : 'admin';
  });
}

function deleteUser(username) {
  updateJsonSync(USERS_FILE, [], users => {
    const target = users.find(u => u.username === username);
    if (!target) throw new Error('not_found');
    if ((target.role || 'admin') === 'admin' && countAdmins(users) <= 1) {
      throw new Error('last_admin');
    }
    return users.filter(u => u.username !== username);
  });
}

function verifyPassword(username, password) {
  const user = findUser(username);
  if (!user) return false;
  return bcrypt.compareSync(password || '', user.passwordHash);
}

module.exports = { loadUsers, listUsers, findUser, upsertUser, setRole, deleteUser, verifyPassword, countAdmins };
