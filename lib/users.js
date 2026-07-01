const path = require('path');
const bcrypt = require('bcryptjs');
const { readJson, writeJson } = require('./jsonStore');

// DATA_DIR surchargeable via l'environnement, principalement pour les tests
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
  return readJson(USERS_FILE, []);
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
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

// Crée l'utilisateur s'il n'existe pas, ou met à jour mot de passe / rôle si fournis
function upsertUser(username, password, role) {
  const users = loadUsers();
  const existing = users.find(u => u.username === username);

  if (existing) {
    if (password) existing.passwordHash = bcrypt.hashSync(password, 10);
    if (role) existing.role = role;
  } else {
    if (!password) throw new Error('password_required');
    users.push({ username, passwordHash: bcrypt.hashSync(password, 10), role: role === 'viewer' ? 'viewer' : 'admin' });
  }
  saveUsers(users);
}

function setRole(username, role) {
  const users = loadUsers();
  const target = users.find(u => u.username === username);
  if (!target) throw new Error('not_found');
  const currentRole = target.role || 'admin';
  if (currentRole === 'admin' && role !== 'admin' && countAdmins(users) <= 1) {
    throw new Error('last_admin');
  }
  target.role = role === 'viewer' ? 'viewer' : 'admin';
  saveUsers(users);
}

function deleteUser(username) {
  const users = loadUsers();
  const target = users.find(u => u.username === username);
  if (!target) throw new Error('not_found');
  if ((target.role || 'admin') === 'admin' && countAdmins(users) <= 1) {
    throw new Error('last_admin');
  }
  saveUsers(users.filter(u => u.username !== username));
}

function verifyPassword(username, password) {
  const user = findUser(username);
  if (!user) return false;
  return bcrypt.compareSync(password || '', user.passwordHash);
}

module.exports = { loadUsers, listUsers, findUser, upsertUser, setRole, deleteUser, verifyPassword, countAdmins };
