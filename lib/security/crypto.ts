import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

/**
 * The most sensitive fields are kept encrypted in the database (AES-256-GCM,
 * key DATA_ENCRYPTION_KEY, only on the server): a copy of the database alone
 * shows nothing of supplier invoices, IBANs, sick-note numbers, tax codes,
 * staff documents and certificates. The app reads them as before - the
 * Prisma extension below encrypts on write and decrypts on read. Values from
 * before the key are read as they are and encrypted by the console's
 * "Cifra i dati esistenti".
 *
 * Losing the key loses those fields: it lives in Railway and in a password
 * manager, nowhere else.
 */

const TEXT_PREFIX = "enc:v1:";
const BYTES_MAGIC = Buffer.from("WBE1");

/** Model → the fields kept encrypted. */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  SupplierInvoice: ["xmlGz"],
  SupplierPayment: ["iban"],
  Request: ["certificateCode"],
  EmployeeBar: ["payrollCode"],
  Document: ["content"],
  CourseCertificate: ["content"],
};

let cachedKey: Buffer | null | undefined;
function key() {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  const parsed = raw ? Buffer.from(raw, "base64") : null;
  // 32 bytes in base64, or any long random text (Railway's ${{ secret(64) }}),
  // turned into 32 bytes by SHA-256. Shorter than 32 characters is refused.
  cachedKey = parsed && parsed.length === 32 ? parsed : raw && raw.length >= 32 ? createHash("sha256").update(raw).digest() : null;
  if (raw && !cachedKey) console.error("[crypto] DATA_ENCRYPTION_KEY is too short: encryption is off");
  return cachedKey;
}

export function encryptionEnabled() {
  return Boolean(key());
}

function seal(plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key()!, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function open(sealed: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key()!, sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]);
}

export function isEncrypted(value: unknown) {
  if (typeof value === "string") return value.startsWith(TEXT_PREFIX);
  if (value instanceof Uint8Array) return value.length > 4 && Buffer.from(value.subarray(0, 4)).equals(BYTES_MAGIC);
  return false;
}

export function encryptValue(value: unknown): unknown {
  if (!key() || value === null || value === undefined || isEncrypted(value)) return value;
  if (typeof value === "string") return value === "" ? value : `${TEXT_PREFIX}${seal(Buffer.from(value, "utf8")).toString("base64")}`;
  if (value instanceof Uint8Array) return new Uint8Array(Buffer.concat([BYTES_MAGIC, seal(Buffer.from(value))]));
  if (typeof value === "object" && value && "set" in value) return { ...(value as object), set: encryptValue((value as { set: unknown }).set) };
  return value;
}

export function decryptValue(value: unknown): unknown {
  if (!key() || !isEncrypted(value)) return value;
  try {
    if (typeof value === "string") return open(Buffer.from(value.slice(TEXT_PREFIX.length), "base64")).toString("utf8");
    const bytes = Buffer.from(value as Uint8Array);
    const plain = open(bytes.subarray(4));
    return value instanceof Buffer ? plain : new Uint8Array(plain);
  } catch (error) {
    console.error("[crypto] a field could not be decrypted", error instanceof Error ? error.message : error);
    return value;
  }
}

function encryptData(data: unknown, fields: string[]): unknown {
  if (Array.isArray(data)) return data.map((item) => encryptData(item, fields));
  if (!data || typeof data !== "object") return data;
  const copy: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const field of fields) if (field in copy) copy[field] = encryptValue(copy[field]);
  return copy;
}

/** Results come back with every encrypted value opened, at any depth (includes too). */
function decryptDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === "string" || value instanceof Uint8Array) return decryptValue(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) value[index] = decryptDeep(value[index], depth + 1);
    return value;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    for (const entry of Object.keys(value)) (value as Record<string, unknown>)[entry] = decryptDeep((value as Record<string, unknown>)[entry], depth + 1);
  }
  return value;
}

const WRITES = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert"]);

export const fieldEncryption = Prisma.defineExtension({
  name: "field-encryption",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!key()) return query(args);
        const fields = ENCRYPTED_FIELDS[model];
        if (fields && WRITES.has(operation) && args && typeof args === "object") {
          const input = args as Record<string, unknown>;
          if ("data" in input) input.data = encryptData(input.data, fields);
          if ("create" in input) input.create = encryptData(input.create, fields);
          if ("update" in input) input.update = encryptData(input.update, fields);
        }
        return decryptDeep(await query(args));
      },
    },
  },
});
