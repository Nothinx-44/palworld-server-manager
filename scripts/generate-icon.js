// Génère build/icon.ico (icône de l'exe) sans aucune dépendance : une patte de Pal dessinée
// pixel par pixel (cercles anti-aliasés) dans un BMP 32 bits encapsulé au format ICO.
// Lancé automatiquement par `npm run dist`.
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const OUT = path.join(__dirname, '..', 'build', 'icon.ico');

// Couleurs du thème du dashboard
const BG = { r: 0xe2, g: 0x98, b: 0x4a };   // orange accent
const FG = { r: 0x14, g: 0x18, b: 0x1f };   // fond sombre

// Formes : un disque de fond + la patte (coussinet elliptique + 4 doigts)
const bgCircle = { cx: 128, cy: 128, r: 120 };
const pad = { cx: 128, cy: 163, rx: 47, ry: 38 };
const toes = [
  { cx: 76, cy: 112, r: 21 },
  { cx: 108, cy: 86, r: 22 },
  { cx: 148, cy: 86, r: 22 },
  { cx: 180, cy: 112, r: 21 }
];

// Couverture anti-aliasée d'un pixel par un cercle/une ellipse (distance signée au bord)
function circleCoverage(px, py, { cx, cy, r }) {
  const d = Math.hypot(px - cx, py - cy) - r;
  return Math.max(0, Math.min(1, 0.5 - d));
}
function ellipseCoverage(px, py, { cx, cy, rx, ry }) {
  // approximation : distance normalisée multipliée par le rayon moyen
  const nd = Math.hypot((px - cx) / rx, (py - cy) / ry) - 1;
  return Math.max(0, Math.min(1, 0.5 - nd * ((rx + ry) / 2)));
}

function pixelColor(x, y) {
  const p = { x: x + 0.5, y: y + 0.5 };
  const bgA = circleCoverage(p.x, p.y, bgCircle);
  if (bgA <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  let fgA = ellipseCoverage(p.x, p.y, pad);
  for (const toe of toes) fgA = Math.max(fgA, circleCoverage(p.x, p.y, toe));

  const r = Math.round(BG.r + (FG.r - BG.r) * fgA);
  const g = Math.round(BG.g + (FG.g - BG.g) * fgA);
  const b = Math.round(BG.b + (FG.b - BG.b) * fgA);
  return { r, g, b, a: Math.round(bgA * 255) };
}

function buildIco() {
  // Pixels BGRA, lignes de bas en haut (convention BMP)
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { r, g, b, a } = pixelColor(x, y);
      const off = ((SIZE - 1 - y) * SIZE + x) * 4;
      pixels[off] = b; pixels[off + 1] = g; pixels[off + 2] = r; pixels[off + 3] = a;
    }
  }
  const andMask = Buffer.alloc((SIZE * SIZE) / 8); // masque AND vide (l'alpha 32 bits fait foi)

  const bmpHeader = Buffer.alloc(40);
  bmpHeader.writeUInt32LE(40, 0);            // taille du header
  bmpHeader.writeInt32LE(SIZE, 4);           // largeur
  bmpHeader.writeInt32LE(SIZE * 2, 8);       // hauteur x2 (image + masque AND)
  bmpHeader.writeUInt16LE(1, 12);            // plans
  bmpHeader.writeUInt16LE(32, 14);           // bits par pixel
  bmpHeader.writeUInt32LE(pixels.length + andMask.length, 20);

  const imageData = Buffer.concat([bmpHeader, pixels, andMask]);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // réservé
  header.writeUInt16LE(1, 2); // type : icône
  header.writeUInt16LE(1, 4); // nombre d'images

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);  // largeur (0 = 256)
  entry.writeUInt8(0, 1);  // hauteur (0 = 256)
  entry.writeUInt16LE(1, 4);  // plans
  entry.writeUInt16LE(32, 6); // bits par pixel
  entry.writeUInt32LE(imageData.length, 8);
  entry.writeUInt32LE(22, 12); // offset des données (6 + 16)

  return Buffer.concat([header, entry, imageData]);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buildIco());
console.log(`Icône générée : ${OUT}`);
