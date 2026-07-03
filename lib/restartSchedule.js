const path = require('path');
const { readJson, writeJson } = require('./jsonStore');
const { DATA_DIR } = require('./paths');
const { parseSimpleCron } = require('./simpleCron');

// Planning du redémarrage récurrent, configurable depuis le web (remplace le RESTART_CRON figé
// dans le .env). Mêmes champs que backupSchedule.js, plus warningMinutes (délai d'avertissement
// aux joueurs avant le redémarrage effectif).
const FILE = path.join(DATA_DIR, 'restart-schedule.json');

// RESTART_CRON legacy ("M H * * *" ou "M H * * D1,D2") : converti en défauts au 1er amorçage,
// pour ne pas silencieusement désactiver un redémarrage déjà configuré par un utilisateur existant.
function defaultsFromEnvCron() {
  const parsed = parseSimpleCron(process.env.RESTART_CRON);
  if (!parsed) return null;
  return {
    enabled: true,
    times: parsed.times,
    days: parsed.days,
    warningMinutes: parseInt(process.env.RESTART_WARNING_MINUTES || '5', 10)
  };
}

function defaults() {
  return defaultsFromEnvCron() || {
    enabled: false,
    times: ['05:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    warningMinutes: parseInt(process.env.RESTART_WARNING_MINUTES || '5', 10)
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
    warningMinutes: Math.max(1, Math.min(60, parseInt(cfg.warningMinutes, 10) || d.warningMinutes))
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

// Une expression cron par heure programmée (jours sélectionnés, 7/7 -> "*").
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
