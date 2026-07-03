const fs = require('fs');

// Espace disque libre du volume contenant `dirPath`. fs.statfsSync est natif (Node ≥ 18.15/19.6,
// fonctionne aussi sous Windows) : pas besoin de spawn `wmic`/PowerShell ni de dépendance externe.
// Renvoie null si l'appel échoue (chemin inexistant, plateforme non supportée...) plutôt que de
// faire planter l'appelant.
function freeSpace(dirPath) {
  try {
    const stats = fs.statfsSync(dirPath);
    return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
  } catch {
    return null;
  }
}

module.exports = { freeSpace };
