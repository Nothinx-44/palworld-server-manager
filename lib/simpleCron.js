// Convertit une expression cron simple "M H * * *" ou "M H * * D1,D2..." en { times: ["HH:MM"],
// days: [0..6] }. Renvoie null si l'expression n'a pas ce format restreint — les expressions plus
// complexes (listes d'heures, pas, etc.) ne sont pas convertibles en planning "heures + jours" tel
// qu'édité depuis le web ; dans ce cas l'appelant retombe sur ses propres valeurs par défaut.
function parseSimpleCron(expr) {
  const m = String(expr || '').trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\*|[0-6](,[0-6])*)$/);
  if (!m) return null;
  const minute = parseInt(m[1], 10);
  const hour = parseInt(m[2], 10);
  if (minute > 59 || hour > 23) return null;
  const days = m[3] === '*' ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(m[3].split(',').map(Number))].sort((a, b) => a - b);
  return { times: [`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`], days };
}

module.exports = { parseSimpleCron };
