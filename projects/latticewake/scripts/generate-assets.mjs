import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const amount = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - amount * dx, y - ay - amount * dy);
}

function paintLogo(x, y) {
  const radius = Math.hypot(x - 256, y - 256);
  if (Math.abs(radius - 193) < 7 || Math.abs(x - 256) < 3 && y > 78 && y < 434
    || Math.abs(y - 256) < 3 && x > 78 && x < 434) return [48, 103, 119, 255];
  const diamond = [[256, 104], [408, 256], [256, 408], [104, 256]];
  for (let index = 0; index < diamond.length; index++) {
    const a = diamond[index] ?? [0, 0]; const b = diamond[(index + 1) % diamond.length] ?? [0, 0];
    if (segmentDistance(x, y, a[0], a[1], b[0], b[1]) < 5) return [116, 222, 211, 255];
  }
  const core = Math.abs(x - 256) + Math.abs(y - 256);
  if (core < 69) return [242, 236, 211, 255];
  if (core < 81) return [255, 179, 100, 255];
  return undefined;
}

function png(width, height, render) {
  const rowBytes = width * 4;
  const pixels = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    const offset = y * (rowBytes + 1);
    pixels[offset] = 0;
    for (let x = 0; x < width; x++) pixels.set(render(x, y), offset + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function squareIcon(size, scale = 1) {
  return png(size, size, (x, y) => {
    const unit = 512 / size;
    const localX = ((x + 0.5) * unit - 256) / scale + 256;
    const localY = ((y + 0.5) * unit - 256) / scale + 256;
    const color = paintLogo(localX, localY);
    return color ?? [8, 13, 21, 255];
  });
}

function socialCard() {
  const width = 1200; const height = 630;
  return png(width, height, (x, y) => {
    const logoCenterX = 286; const logoCenterY = 315; const logoScale = 0.52;
    const localX = (x - logoCenterX) / logoScale + 256;
    const localY = (y - logoCenterY) / logoScale + 256;
    const logo = paintLogo(localX, localY);
    if (logo) return logo;
    if (x > 560 && x < 1160 && (Math.abs(y - 128) < 2 || Math.abs(y - 500) < 2)) return [48, 103, 119, 255];
    if (x > 592 && x < 1130 && (Math.abs(y - 205) < 2 || Math.abs(y - 425) < 2)) return [48, 103, 119, 255];
    if (x > 592 && x < 1130 && Math.abs(y - 315) < 1 && Math.floor(x / 24) % 5 === 0) return [116, 222, 211, 255];
    const star = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (x > 560 && star % 997 < 2) return [116, 222, 211, 255];
    return [8, 13, 21, 255];
  });
}

export async function generateAssets(directory = resolve(root, 'public')) {
  const icons = resolve(directory, 'icons');
  await mkdir(icons, { recursive: true });
  await Promise.all([
    writeFile(resolve(icons, 'latticewake-192.png'), squareIcon(192)),
    writeFile(resolve(icons, 'latticewake-512.png'), squareIcon(512)),
    writeFile(resolve(icons, 'latticewake-512-maskable.png'), squareIcon(512, 0.6)),
    writeFile(resolve(icons, 'apple-touch-icon.png'), squareIcon(180)),
    writeFile(resolve(icons, 'favicon-32.png'), squareIcon(32)),
    writeFile(resolve(directory, 'social-card.png'), socialCard()),
  ]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateAssets();
  console.log('PASS generated original PWA, favicon and social PNG assets.');
}
