/**
 * Self-contained ISO/IEC 18004 QR Code matrix generator (Byte mode, ECC Level L).
 * Produces a boolean 2D grid (`true` = dark module) for rendering scannable SVGs
 * without external dependencies or network requests.
 */

// Total codewords and EC codewords per block for Versions 1..10 at Level L:
const VERSION_L_SPECS: Array<{
  totalDataBytes: number;
  ecBytesPerBlock: number;
  blocks: number;
  alignment: number[];
}> = [
  { totalDataBytes: 0, ecBytesPerBlock: 0, blocks: 0, alignment: [] }, // dummy 0
  { totalDataBytes: 19, ecBytesPerBlock: 7, blocks: 1, alignment: [] }, // v1 (21x21)
  { totalDataBytes: 34, ecBytesPerBlock: 10, blocks: 1, alignment: [6, 18] }, // v2 (25x25)
  { totalDataBytes: 55, ecBytesPerBlock: 15, blocks: 1, alignment: [6, 22] }, // v3 (29x29)
  { totalDataBytes: 80, ecBytesPerBlock: 20, blocks: 1, alignment: [6, 26] }, // v4 (33x33)
  { totalDataBytes: 108, ecBytesPerBlock: 26, blocks: 1, alignment: [6, 30] }, // v5 (37x37)
  { totalDataBytes: 136, ecBytesPerBlock: 18, blocks: 2, alignment: [6, 34] }, // v6 (41x41)
  { totalDataBytes: 156, ecBytesPerBlock: 20, blocks: 2, alignment: [6, 22, 38] }, // v7 (45x45)
  { totalDataBytes: 194, ecBytesPerBlock: 24, blocks: 2, alignment: [6, 24, 42] }, // v8 (49x49)
  { totalDataBytes: 232, ecBytesPerBlock: 30, blocks: 2, alignment: [6, 26, 46] }, // v9 (53x53)
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j++) {
      rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const utf8 = new TextEncoder().encode(text);
  let version = 1;
  while (
    version < VERSION_L_SPECS.length &&
    utf8.length + 3 > VERSION_L_SPECS[version].totalDataBytes
  ) {
    version++;
  }
  if (version >= VERSION_L_SPECS.length) {
    version = VERSION_L_SPECS.length - 1;
  }
  const spec = VERSION_L_SPECS[version];
  const payload = utf8.slice(0, spec.totalDataBytes - 3);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode 0100 (Byte)
  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const byte of payload) pushBits(byte, 8);
  pushBits(0, Math.min(4, spec.totalDataBytes * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(spec.totalDataBytes);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataBytes[i] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < spec.totalDataBytes; i++, p ^= 1) {
    dataBytes[i] = padBytes[p];
  }

  // Split into blocks and compute Reed-Solomon EC
  const blockSize = Math.floor(spec.totalDataBytes / spec.blocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.blocks; b++) {
    const slice = dataBytes.slice(b * blockSize, (b + 1) * blockSize);
    dataBlocks.push(slice);
    ecBlocks.push(rsEncode(slice, spec.ecBytesPerBlock));
  }

  const codewords: number[] = [];
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < spec.blocks; b++) codewords.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < spec.ecBytesPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) codewords.push(ecBlocks[b][i]);
  }

  const size = 17 + version * 4;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );

  const setModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      grid[r][c] = dark;
      reserved[r][c] = true;
    }
  };

  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(row + r, col + c, inOuter && (onBorder || inInner));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  const align = spec.alignment;
  for (const r of align) {
    for (const c of align) {
      if (
        (r === 6 && c === 6) ||
        (r === 6 && c === size - 7) ||
        (r === size - 7 && c === 6)
      ) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.max(Math.abs(dr), Math.abs(dc)) === 2 || (dr === 0 && dc === 0);
          setModule(r + dr, c + dc, dark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // Dark module + reserve format info areas
  setModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // Place data bits upward/downward in 2-column strips with mask 0 ((r + c) % 2 === 0)
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (reserved[r][c]) continue;
        let dark = false;
        if (bitIdx < totalBits) {
          const byte = codewords[bitIdx >>> 3];
          dark = ((byte >>> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        if ((r + c) % 2 === 0) dark = !dark;
        grid[r][c] = dark;
      }
    }
    upward = !upward;
  }

  // Format information for Level L (01) + Mask 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> i) & 1) === 1;
    if (i < 6) grid[i][8] = bit;
    else if (i < 8) grid[i + 1][8] = bit;
    else grid[size - 15 + i][8] = bit;

    if (i < 8) grid[8][size - 1 - i] = bit;
    else if (i < 9) grid[8][15 - i] = bit;
    else grid[8][15 - i - 1] = bit;
  }

  return grid;
}
