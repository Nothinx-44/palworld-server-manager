const path = require('path');
const { readJson, writeJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');

// Planning des sauvegardes automatiques, configurable depuis le web :
//   enabled   : sauvegardes planifiées activées ou non
//   times     : liste d'heures "HH:MM" (plusieurs par jour possible)
//   days      : jours de la semaine (0=dimanche … 6=samedi), tous par défaut
//   keepCount : nombre de sauvegardes conservées (les plus anciennes au-delà sont supprimées)
const FILE = path.join(DATA_DIR, 'backup-schedule.json');

function defaults() {
  return {
    enabled: true,
    times: ['04:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    keepCount: parseInt(process.env.BACKUP_KEEP_COUNT || '14', 10)
  };
}

function normalize(cfg = {}) {
  const d = defaults();
  const times = Array.isArray(cfg.times)
    ? [...new Set(cfg.times.filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort()
    : [];
  const days = Array.isArray(cfg.days)
    ? [...new Set(cfg.days.map(Number).filter(n => n >= 0 && n <= 6))].sort((a, b) => a - b)
    : [];
  return {
    enabled: cfg.enabled !== undefined ? !!cfg.enabled : d.enabled,
    times: times.length ? times : d.times,
    days: days.length ? days : d.days,
    keepCount: Math.max(1, Math.min(1000, parseInt(cfg.keepCount, 10) || d.keepCount))
  };
}

function load() {
  return normalize(readJson(FILE, defaults()));
}

function save(cfg) {
  const normalized = normalize(cfg);
  writeJson(FILE, normalized);
  return normalized;
}

// Une expression cron par heure programmée, couvrant les jours sélectionnés (7/7 -> "*").
function toCronExpressions(cfg = load()) {
  const c = normalize(cfg);
  if (!c.enabled || !c.times.length) return [];
  const dow = c.days.length >= 7 ? '*' : c.days.join(',');
  return c.times.map(t => {
    const [h, m] = t.split(':');
    return `${parseInt(m, 10)} ${parseInt(h, 10)} * * ${dow}`;
  });
}

module.exports = { load, save, normalize, toCronExpressions, defaults, FILE };
