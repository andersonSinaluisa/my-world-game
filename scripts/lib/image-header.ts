import fs from 'fs';

import type { ImageInfo } from '../../src/engine/content/validate-pack';

/**
 * Reads image dimensions from the file header (HU-GAME-069 R8) without native dependencies.
 * Supports WebP (VP8, VP8L, VP8X) and PNG (reported as format "png" so the validator can reject it).
 */
export function readImageHeader(path: string): ImageInfo | undefined {
  if (!fs.existsSync(path)) return undefined;
  const fd = fs.openSync(path, 'r');
  const b = Buffer.alloc(40);
  try {
    fs.readSync(fd, b, 0, 40, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { format: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { format: 'webp', w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { format: 'webp', w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
    return { format: 'webp', w: 0, h: 0 };
  }
  if (b.readUInt32BE(0) === 0x89504e47) return { format: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  return { format: 'unknown', w: 0, h: 0 };
}
