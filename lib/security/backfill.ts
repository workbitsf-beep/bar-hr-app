import "server-only";

import { prisma } from "@/lib/prisma";
import { encryptionEnabled, ENCRYPTED_FIELDS } from "./crypto";

/**
 * The values written before the key: found with plain SQL (the client opens
 * everything it reads, so it cannot tell), rewritten through the client,
 * which encrypts them. Batch by batch; safe to run again.
 */

const TABLES: Record<string, { table: string; bytes: boolean }> = {
  "SupplierInvoice.xmlGz": { table: "SupplierInvoice", bytes: true },
  "SupplierPayment.iban": { table: "SupplierPayment", bytes: false },
  "Request.certificateCode": { table: "Request", bytes: false },
  "EmployeeBar.payrollCode": { table: "EmployeeBar", bytes: false },
  "EmployeeBar.terminalPin": { table: "EmployeeBar", bytes: false },
  "Document.content": { table: "Document", bytes: true },
  "CourseCertificate.content": { table: "CourseCertificate", bytes: true },
};

function condition(field: string, bytes: boolean) {
  return bytes
    ? `"${field}" IS NOT NULL AND length("${field}") > 4 AND substring("${field}" from 1 for 4) <> '\\x57424531'::bytea`
    : `"${field}" IS NOT NULL AND "${field}" <> '' AND "${field}" NOT LIKE 'enc:v1:%'`;
}

/** How many values are still in clear, field by field. */
export async function plainCounts() {
  const result: Record<string, number> = {};
  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    for (const field of fields) {
      const { table, bytes } = TABLES[`${model}.${field}`];
      const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "${table}" WHERE ${condition(field, bytes)}`);
      result[`${model}.${field}`] = Number(rows[0]?.n ?? 0);
    }
  }
  return result;
}

let running = false;

export async function encryptExisting() {
  if (!encryptionEnabled() || running) return 0;
  running = true;
  let done = 0;
  try {
    for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
      for (const field of fields) {
        const { table, bytes } = TABLES[`${model}.${field}`];
        const delegate = (prisma as unknown as Record<string, { update: (args: unknown) => Promise<unknown>; findUnique: (args: unknown) => Promise<Record<string, unknown> | null> }>)[
          model.charAt(0).toLowerCase() + model.slice(1)
        ];
        for (;;) {
          const ids = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM "${table}" WHERE ${condition(field, bytes)} LIMIT 100`);
          if (!ids.length) break;
          let progress = 0;
          for (const { id } of ids) {
            try {
              // Read through the client (plain, since it is not encrypted yet) and write back: the extension seals it.
              const row = await delegate.findUnique({ where: { id }, select: { [field]: true } });
              if (row && row[field] !== null && row[field] !== undefined) {
                await delegate.update({ where: { id }, data: { [field]: row[field] } });
                done += 1;
                progress += 1;
              }
            } catch (error) {
              console.error("[crypto] backfill row failed", table, id, error instanceof Error ? error.message : error);
            }
          }
          // Nothing moved: stop rather than loop on the same rows.
          if (!progress) break;
        }
      }
    }
  } finally {
    running = false;
  }
  return done;
}
