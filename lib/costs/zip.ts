import "server-only";

import { inflateRawSync } from "node:zlib";

export type ZipEntry = { name: string; data: Buffer };

/**
 * The files inside a zip, zips inside it opened too - the cassetto fiscale
 * hands over one zip per month, sometimes wrapping one zip per day. Only
 * stored and deflated entries exist in those archives; anything else is
 * skipped rather than failing the whole upload.
 */
export function readZip(buffer: Buffer, depth = 0): ZipEntry[] {
  const end = findEndOfCentralDirectory(buffer);
  if (end < 0) throw new Error("Il file non è uno zip leggibile.");

  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localName = buffer.readUInt16LE(localOffset + 26);
    const localExtra = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const raw = buffer.subarray(start, start + compressedSize);

    let data: Buffer;
    try {
      if (method === 0) data = Buffer.from(raw);
      else if (method === 8) data = inflateRawSync(raw);
      else continue;
    } catch {
      continue;
    }

    if (/\.zip$/i.test(name) && depth < 3) {
      try {
        entries.push(...readZip(data, depth + 1).map((inner) => ({ name: `${name}/${inner.name}`, data: inner.data })));
      } catch {
        // A damaged inner zip: the rest of the archive still counts.
      }
      continue;
    }
    entries.push({ name, data });
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const stop = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= stop; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

export function isZip(buffer: Buffer) {
  return buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
}
