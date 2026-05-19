/**
 * qrCode.ts — Pure TypeScript QR code SVG generator (no dependencies).
 *
 * Generates a minimal QR code as an SVG string for PWA install links.
 * Uses Reed-Solomon error correction (Level L) for compact output.
 */

// ── Galois Field GF(256) primitives ───────────────────
const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = x << 1;
    if (x & 256) x ^= 0x11d;
  }
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

// ── Reed-Solomon generator polynomial ─────────────────
function rsGenPoly(nsym: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < nsym; i++) {
    const ng = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data: Uint8Array, nsym: number): Uint8Array {
  const gen = rsGenPoly(nsym);
  const out = new Uint8Array(data.length + nsym);
  out.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = out[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        out[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return out.slice(data.length);
}

// ── QR code matrix builder (Version 1-4, Mode Byte, ECC L) ─
interface QRVersion {
  version: number;
  size: number;
  dataBytes: number;
  ecBytes: number;
}

const VERSIONS: QRVersion[] = [
  { version: 1, size: 21, dataBytes: 19, ecBytes: 7 },
  { version: 2, size: 25, dataBytes: 34, ecBytes: 10 },
  { version: 3, size: 29, dataBytes: 55, ecBytes: 15 },
  { version: 4, size: 33, dataBytes: 80, ecBytes: 20 },
];

function selectVersion(byteCount: number): QRVersion {
  // byte mode overhead: 4 (mode) + 8 (count) + up to 4 (terminator) = ~2 bytes overhead
  for (const v of VERSIONS) {
    if (byteCount + 2 <= v.dataBytes) return v;
  }
  return VERSIONS[VERSIONS.length - 1];
}

function encodeData(text: string, ver: QRVersion): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const totalBits = ver.dataBytes * 8;
  const bits: number[] = [];

  // Mode indicator: 0100 (byte mode)
  bits.push(0, 1, 0, 0);

  // Character count (8 bits for versions 1-9)
  for (let i = 7; i >= 0; i--) bits.push((bytes.length >> i) & 1);

  // Data bits
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }

  // Terminator (up to 4 bits)
  const remaining = totalBits - bits.length;
  for (let i = 0; i < Math.min(4, remaining); i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalBits) {
    const pb = padBytes[padIdx % 2];
    for (let i = 7; i >= 0; i--) bits.push((pb >> i) & 1);
    padIdx++;
  }

  const data = new Uint8Array(ver.dataBytes);
  for (let i = 0; i < ver.dataBytes; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i * 8 + j] || 0);
    data[i] = byte;
  }
  return data;
}

function createMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(-1));
}

function setModule(matrix: number[][], row: number, col: number, val: number): void {
  if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length) {
    matrix[row][col] = val;
  }
}

function placeFinderPattern(matrix: number[][], row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const val = inOuter && (onBorder || inInner) ? 1 : 0;
      setModule(matrix, row + r, col + c, val);
    }
  }
}

function placeAlignmentPattern(matrix: number[][], row: number, col: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const val = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0) ? 1 : 0;
      setModule(matrix, row + r, col + c, val);
    }
  }
}

function placeTimingPatterns(matrix: number[][]): void {
  const size = matrix.length;
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (matrix[6][i] === -1) matrix[6][i] = val;
    if (matrix[i][6] === -1) matrix[i][6] = val;
  }
}

function reserveFormatBits(matrix: number[][]): void {
  const size = matrix.length;
  for (let i = 0; i < 8; i++) {
    if (matrix[8][i] === -1) matrix[8][i] = 0;
    if (matrix[i][8] === -1) matrix[i][8] = 0;
    if (matrix[8][size - 1 - i] === -1) matrix[8][size - 1 - i] = 0;
    if (matrix[size - 1 - i][8] === -1) matrix[size - 1 - i][8] = 0;
  }
  if (matrix[8][8] === -1) matrix[8][8] = 0;
  matrix[size - 8][8] = 1; // dark module
}

function placeData(matrix: number[][], data: Uint8Array, ec: Uint8Array): void {
  const size = matrix.length;
  const allBits: number[] = [];
  for (const b of data) for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);
  for (const b of ec) for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);

  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // skip timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (c < 0) continue;
        if (matrix[row][c] === -1) {
          matrix[row][c] = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }
}

function applyMask0(matrix: number[][], reserved: number[][]): void {
  const size = matrix.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c] !== -1) continue; // skip reserved
      if ((r + c) % 2 === 0) matrix[r][c] ^= 1;
    }
  }
}

function placeFormatInfo(matrix: number[][]): void {
  // ECC level L (01) + mask 0 (000) = 01000 → format info with BCH
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const size = matrix.length;

  // Horizontal: row 8
  const hCols = [0, 1, 2, 3, 4, 5, 7, 8, size - 8, size - 7, size - 6, size - 5, size - 4, size - 3, size - 2];
  for (let i = 0; i < 15; i++) matrix[8][hCols[i]] = formatBits[i];

  // Vertical: col 8
  const vRows = [size - 1, size - 2, size - 3, size - 4, size - 5, size - 6, size - 7, 8, 7, 5, 4, 3, 2, 1, 0];
  for (let i = 0; i < 15; i++) matrix[vRows[i]][8] = formatBits[i];
}

/**
 * Generate a QR code SVG string for the given text.
 */
export function generateQRCodeSVG(text: string, moduleSize = 4, margin = 2): string {
  const ver = selectVersion(new TextEncoder().encode(text).length);
  const size = ver.size;

  // Build reserved mask (to know which cells are patterns vs data)
  const reserved = createMatrix(size);
  placeFinderPattern(reserved, 0, 0);
  placeFinderPattern(reserved, 0, size - 7);
  placeFinderPattern(reserved, size - 7, 0);
  placeTimingPatterns(reserved);
  reserveFormatBits(reserved);
  if (ver.version >= 2) placeAlignmentPattern(reserved, size - 7, size - 7);

  // Build actual matrix
  const matrix = createMatrix(size);
  placeFinderPattern(matrix, 0, 0);
  placeFinderPattern(matrix, 0, size - 7);
  placeFinderPattern(matrix, size - 7, 0);
  placeTimingPatterns(matrix);
  reserveFormatBits(matrix);
  if (ver.version >= 2) placeAlignmentPattern(matrix, size - 7, size - 7);

  const data = encodeData(text, ver);
  const ec = rsEncode(data, ver.ecBytes);
  placeData(matrix, data, ec);
  applyMask0(matrix, reserved);
  placeFormatInfo(matrix);

  // Render SVG
  const totalSize = (size + margin * 2) * moduleSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">`;
  svg += `<rect width="${totalSize}" height="${totalSize}" fill="#fff" rx="8"/>`;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const x = (c + margin) * moduleSize;
        const y = (r + margin) * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#0f172a" rx="0.8"/>`;
      }
    }
  }

  svg += "</svg>";
  return svg;
}
