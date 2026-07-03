// Génère build/icon.ico (multi-résolution) et public/logo.png à partir de la source carrée
// build/logo-source.png (le vrai logo, committé dans le repo). Aucune dépendance : décodeur/
// encodeur PNG minimal + encodeur ICO maison (mêmes techniques que l'ancien generate-icon.js,
// appliquées à une vraie image au lieu d'un dessin programmatique).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SOURCE = path.join(__dirname, '..', 'build', 'logo-source.png');
const ICO_OUT = path.join(__dirname, '..', 'build', 'icon.ico');
const WEB_LOGO_OUT = path.join(__dirname, '..', 'public', 'logo.png');
const ICO_SIZES = [256, 48, 32, 16];
const WEB_LOGO_SIZE = 256;

// ---------- Décodage PNG (8 bits/canal, RGB/RGBA, sans entrelacement) ----------
function readChunks(buf) {
  let off = 8;
  const chunks = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find(c => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  if (ihdr[8] !== 8) throw new Error(`bitDepth non supporté: ${ihdr[8]}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr[9]];
  if (!channels) throw new Error(`colorType non supporté: ${ihdr[9]}`);

  const idat = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
  const raw = zlib.inflateSync(idat);
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let srcOff = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[srcOff]; srcOff++;
    const rowStart = y * stride, prevRowStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const val = raw[srcOff + x];
      const a = x >= channels ? out[rowStart + x - channels] : 0;
      const b = y > 0 ? out[prevRowStart + x] : 0;
      const c = (y > 0 && x >= channels) ? out[prevRowStart + x - channels] : 0;
      let recon;
      switch (filter) {
        case 0: recon = val; break;
        case 1: recon = val + a; break;
        case 2: recon = val + b; break;
        case 3: recon = val + Math.floor((a + b) / 2); break;
        case 4: recon = val + paeth(a, b, c); break;
        default: throw new Error(`filtre PNG inconnu: ${filter}`);
      }
      out[rowStart + x] = recon & 0xff;
    }
    srcOff += stride;
  }

  if (channels === 4) return { width, height, rgba: out };
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < out.length; i += channels, j += 4) {
    rgba[j] = out[i];
    rgba[j + 1] = channels >= 3 ? out[i + 1] : out[i];
    rgba[j + 2] = channels >= 3 ? out[i + 2] : out[i];
    rgba[j + 3] = 255;
  }
  return { width, height, rgba };
}

// ---------- Redimensionnement (filtre par zone, moyenne des pixels source couverts) ----------
function resize(src, srcW, srcH, dstSize) {
  const dst = Buffer.alloc(dstSize * dstSize * 4);
  const scale = srcW / dstSize; // image source carrée (srcW === srcH)
  for (let dy = 0; dy < dstSize; dy++) {
    const sy0 = Math.floor(dy * scale), sy1 = Math.max(sy0 + 1, Math.floor((dy + 1) * scale));
    for (let dx = 0; dx < dstSize; dx++) {
      const sx0 = Math.floor(dx * scale), sx1 = Math.max(sx0 + 1, Math.floor((dx + 1) * scale));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1 && sy < srcH; sy++) {
        for (let sx = sx0; sx < sx1 && sx < srcW; sx++) {
          const i = (sy * srcW + sx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
          n++;
        }
      }
      const o = (dy * dstSize + dx) * 4;
      dst[o] = Math.round(r / n); dst[o + 1] = Math.round(g / n);
      dst[o + 2] = Math.round(b / n); dst[o + 3] = Math.round(a / n);
    }
  }
  return dst;
}

// ---------- Encodage PNG (8 bits/canal RGBA) ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- Encodage ICO (une entrée BMP 32bpp par taille) ----------
function bmpEntry(size, rgba) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcOff = (y * size + x) * 4;
      const dstOff = ((size - 1 - y) * size + x) * 4; // BMP : lignes de bas en haut
      pixels[dstOff] = rgba[srcOff + 2]; pixels[dstOff + 1] = rgba[srcOff + 1];
      pixels[dstOff + 2] = rgba[srcOff]; pixels[dstOff + 3] = rgba[srcOff + 3];
    }
  }
  const andMask = Buffer.alloc((size * size) / 8);
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(pixels.length + andMask.length, 20);
  return Buffer.concat([header, pixels, andMask]);
}

function encodeIco(sizes, rgbaBySize) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);

  const entries = [];
  const images = [];
  let dataOffset = 6 + 16 * sizes.length;
  sizes.forEach(size => {
    const img = bmpEntry(size, rgbaBySize[size]);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dataOffset += img.length;
    entries.push(entry);
    images.push(img);
  });
  return Buffer.concat([header, ...entries, ...images]);
}

// ---------- Main ----------
if (!fs.existsSync(SOURCE)) {
  console.error(`Logo source introuvable : ${SOURCE}`);
  console.error('Place une image carrée (idéalement 512x512+) à cet emplacement puis relance.');
  process.exit(1);
}

const src = decodePng(fs.readFileSync(SOURCE));
if (src.width !== src.height) {
  console.warn(`⚠️ ${SOURCE} n'est pas carrée (${src.width}x${src.height}) — le logo sera déformé.`);
}

const rgbaBySize = {};
ICO_SIZES.forEach(size => { rgbaBySize[size] = resize(src.rgba, src.width, src.height, size); });

fs.mkdirSync(path.dirname(ICO_OUT), { recursive: true });
fs.writeFileSync(ICO_OUT, encodeIco(ICO_SIZES, rgbaBySize));
console.log(`Icône générée : ${ICO_OUT} (${ICO_SIZES.join(', ')})`);

const webRgba = rgbaBySize[WEB_LOGO_SIZE] || resize(src.rgba, src.width, src.height, WEB_LOGO_SIZE);
fs.writeFileSync(WEB_LOGO_OUT, encodePng(WEB_LOGO_SIZE, webRgba));
console.log(`Logo web généré : ${WEB_LOGO_OUT} (${WEB_LOGO_SIZE}x${WEB_LOGO_SIZE})`);
