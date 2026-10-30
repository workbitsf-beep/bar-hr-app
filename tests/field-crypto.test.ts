import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

test("text and bytes come back as they were, and are unreadable in between", async () => {
  const { decryptValue, encryptValue, isEncrypted } = await import("../lib/security/crypto");
  const iban = "IT60X0542811101000000123456";
  const sealed = encryptValue(iban) as string;
  assert.ok(isEncrypted(sealed));
  assert.ok(!sealed.includes("0542811101"));
  assert.equal(decryptValue(sealed), iban);

  const pdf = new Uint8Array(Buffer.from("%PDF-1.7 busta paga di marzo"));
  const sealedBytes = encryptValue(pdf) as Uint8Array;
  assert.ok(isEncrypted(sealedBytes));
  assert.ok(!Buffer.from(sealedBytes).toString("latin1").includes("busta paga"));
  assert.deepEqual(Buffer.from(decryptValue(sealedBytes) as Uint8Array), Buffer.from(pdf));
});

test("values from before the key are read as they are", async () => {
  const { decryptValue } = await import("../lib/security/crypto");
  assert.equal(decryptValue("RSSMRA80A01H501U"), "RSSMRA80A01H501U");
});
