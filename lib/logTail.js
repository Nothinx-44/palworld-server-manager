const fs = require('fs');

// Lit la fin d'un (gros) fichier log sans le charger en entier : ouvre un descripteur, se
// positionne à `maxBytes` de la fin, et ne lit que ce dernier segment. Renvoie null si le fichier
// n'existe pas.
function readTail(filePath, maxBytes = 65536) {
  if (!fs.existsSync(filePath)) return null;
  const size = fs.statSync(filePath).size;
  const start = Math.max(0, size - maxBytes);
  const length = size - start;
  if (length <= 0) return [];

  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    let text = buffer.toString('utf-8');
    // Si on a coupé au milieu d'une ligne (cas normal quand start > 0), on jette le fragment
    // initial incomplet pour ne pas afficher une ligne tronquée en tête de résultat.
    if (start > 0) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) text = text.slice(firstNewline + 1);
    }
    return text.split(/\r?\n/).filter(Boolean);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { readTail };
