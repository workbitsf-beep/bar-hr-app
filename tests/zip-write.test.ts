import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32, inflateRawSync } from "node:zlib";
import { buildZip } from "../lib/zip-write";

test("a built zip lists every file and each one comes back intact", () => {
  const files = [
    { name: "Bar Elisir/2026-10-01_Fornitore_1.xml", data: Buffer.from("<FatturaElettronica>àèì</FatturaElettronica>", "utf8") },
    { name: "riepilogo.csv", data: Buffer.from("Data;Fornitore\r\n", "utf8") },
  ];
  const zip = buildZip(files);

  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 10), files.length);

  let offset = zip.readUInt32LE(end + 16);
  for (const file of files) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const local = zip.readUInt32LE(offset + 42);
    assert.equal(zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"), file.name);
    assert.equal(zip.readUInt32LE(offset + 16), crc32(file.data));

    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    assert.deepEqual(inflateRawSync(zip.subarray(start, start + size)), file.data);
    offset += 46 + nameLength;
  }
});
