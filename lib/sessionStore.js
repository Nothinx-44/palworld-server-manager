const path = require('path');
const session = require('express-session');
const { readJson, updateJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Store de sessions minimaliste persisté dans data/sessions.json : les connexions survivent aux
// redémarrages du dashboard (le MemoryStore par défaut déconnectait tout le monde), sans ajouter
// de dépendance. Tout vit en mémoire ; l'écriture disque est asynchrone, en best effort.
class JsonSessionStore extends session.Store {
  constructor() {
    super();
    this.sessions = readJson(SESSIONS_FILE, {});
    this.prune();
    // Purge horaire des sessions expirées ; unref() pour ne pas retenir le process
    setInterval(() => this.prune(), 60 * 60 * 1000).unref();
  }

  isExpired(sess) {
    const expires = sess && sess.cookie && sess.cookie.expires;
    return expires ? new Date(expires) <= new Date() : false;
  }

  prune() {
    let changed = false;
    for (const [sid, sess] of Object.entries(this.sessions)) {
      if (this.isExpired(sess)) { delete this.sessions[sid]; changed = true; }
    }
    if (changed) this.flush();
  }

  flush() {
    updateJson(SESSIONS_FILE, {}, () => this.sessions)
      .catch(err => console.error('Écriture des sessions échouée:', err.message || err));
  }

  get(sid, cb) {
    const sess = this.sessions[sid];
    if (!sess || this.isExpired(sess)) return cb(null, null);
    cb(null, sess);
  }

  set(sid, sess, cb) {
    this.sessions[sid] = JSON.parse(JSON.stringify(sess));
    this.flush();
    cb(null);
  }

  destroy(sid, cb) {
    delete this.sessions[sid];
    this.flush();
    cb(null);
  }

  // Appelé à chaque requête (rafraîchit l'expiration) : mise à jour mémoire seulement,
  // pas d'écriture disque à chaque hit — la purge périodique et les set/destroy suffisent.
  touch(sid, sess, cb) {
    if (this.sessions[sid] && sess && sess.cookie) {
      this.sessions[sid].cookie = JSON.parse(JSON.stringify(sess.cookie));
    }
    cb(null);
  }
}

module.exports = { JsonSessionStore, SESSIONS_FILE };
