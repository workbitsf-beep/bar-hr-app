import "server-only";

import { prisma } from "@/lib/prisma";
import { call as openapiCall, sdiConfig } from "@/lib/invoicing/openapi-sdi";
import { RuleError } from "@/lib/rule-error";
import { importInvoiceFiles } from "./import";

/**
 * Supplier invoices that arrive by themselves. The venue registers Openapi's
 * codice destinatario (USAL8PV) at the Agenzia delle Entrate; from then on
 * the SDI delivers every invoice made out to its VAT number to Openapi, which
 * keeps it on Workbit's account and calls us back (event supplier-invoice).
 * The invoices stay in the cassetto fiscale as always, where the venue's
 * accountant reads them.
 */
export const OPENAPI_RECIPIENT_CODE = "USAL8PV";

/** On only when Workbit has decided to pay for receiving: COSTS_INBOX_ENABLED=1. */
export function inboxAvailable() {
  return Boolean(sdiConfig()) && process.env.COSTS_INBOX_ENABLED?.trim() === "1";
}

function digits(value: string | null | undefined) {
  return (value ?? "").replace(/^[A-Z]{2}/i, "").replace(/\D/g, "");
}

function callbackUrl() {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  const key = process.env.OPENAPI_SDI_CALLBACK_KEY?.trim();
  if (!base || !key) throw new RuleError("Manca APP_URL o OPENAPI_SDI_CALLBACK_KEY sul server.");
  return `${base}/api/webhooks/openapi-invoices?key=${encodeURIComponent(key)}`;
}

export async function activateInbox(barId: string) {
  if (!inboxAvailable()) throw new RuleError("La ricezione automatica non è ancora attiva su Workbit.");
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: {
      name: true,
      legalName: true,
      vatNumber: true,
      email: true,
      owner: { select: { email: true } },
      mainBar: { select: { vatNumber: true, legalName: true } },
    },
  });
  const fiscalId = digits(bar?.vatNumber || bar?.mainBar?.vatNumber);
  if (!bar || fiscalId.length < 11) {
    throw new RuleError("Serve la partita IVA del locale: scrivila in Impostazioni prima di attivare.");
  }

  await openapiCall("/business_registry_configurations", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      fiscal_id: fiscalId,
      name: bar.legalName || bar.mainBar?.legalName || bar.name,
      email: bar.email || bar.owner.email,
      apply_signature: false,
      apply_legal_storage: false,
    }),
  }).catch((error: Error) => {
    // Registered by an earlier attempt: fine.
    if (!/exist|already|gi[aà]/i.test(error.message)) throw error;
  });
  await openapiCall("/api_configurations", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ fiscal_id: fiscalId, callbacks: [{ event: "supplier-invoice", url: callbackUrl() }] }),
  });

  await prisma.barSettings.upsert({
    where: { barId },
    create: { barId, invoiceInboxStatus: "WAITING", invoiceInboxFiscalId: fiscalId, invoiceInboxSince: new Date() },
    update: { invoiceInboxStatus: "WAITING", invoiceInboxFiscalId: fiscalId, invoiceInboxSince: new Date() },
  });
  return fiscalId;
}

export async function deactivateInbox(barId: string) {
  const settings = await prisma.barSettings.findUnique({ where: { barId }, select: { invoiceInboxFiscalId: true } });
  if (settings?.invoiceInboxFiscalId && inboxAvailable()) {
    await openapiCall(`/business_registry_configurations/${settings.invoiceInboxFiscalId}`, { method: "DELETE" }).catch((error) => {
      console.error("[costs] inbox registry not deleted", error instanceof Error ? error.message : error);
    });
  }
  await prisma.barSettings.update({ where: { barId }, data: { invoiceInboxStatus: "OFF" } });
}

async function downloadInvoice(uuid: string) {
  const config = sdiConfig();
  if (!config) throw new Error("Openapi non configurato");
  const response = await fetch(`${config.baseUrl}/invoices_download/${encodeURIComponent(uuid)}`, {
    headers: { Authorization: `Bearer ${config.token}`, Accept: "application/octet-stream" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`download ${uuid}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Everything Openapi holds for the venue that is not here yet. Called by the
 * callback, by the night's pass, and from the page.
 */
export async function syncInbox(barId: string) {
  const settings = await prisma.barSettings.findUnique({
    where: { barId },
    select: { invoiceInboxStatus: true, invoiceInboxFiscalId: true },
  });
  if (!settings?.invoiceInboxFiscalId || settings.invoiceInboxStatus === "OFF" || !inboxAvailable()) return { imported: 0 };

  let imported = 0;
  for (let page = 1; page <= 20; page += 1) {
    const list = (await openapiCall(
      `/invoices?type=1&recipient=${encodeURIComponent(settings.invoiceInboxFiscalId)}&page=${page}`,
      { method: "GET" },
    )) as Array<Record<string, unknown>> | null;
    if (!Array.isArray(list) || !list.length) break;

    const uuids = list.map((item) => String(item.uuid ?? "")).filter(Boolean);
    const known = new Set(
      (await prisma.supplierInvoice.findMany({ where: { barId, openapiUuid: { in: uuids } }, select: { openapiUuid: true } })).map(
        (invoice) => invoice.openapiUuid,
      ),
    );
    for (const item of list) {
      const uuid = String(item.uuid ?? "");
      if (!uuid || known.has(uuid)) continue;
      try {
        const data = await downloadInvoice(uuid);
        const name = String(item.sdi_file_name ?? `${uuid}.xml`);
        const result = await importInvoiceFiles({ barId, files: [{ name, data }], source: "openapi", openapiUuid: uuid });
        imported += result.imported;
      } catch (error) {
        console.error("[costs] inbox invoice not imported", uuid, error instanceof Error ? error.message : error);
      }
    }
    if (list.length < 30) break;
  }

  await prisma.barSettings.update({
    where: { barId },
    data: {
      invoiceInboxSyncedAt: new Date(),
      ...(imported > 0 && settings.invoiceInboxStatus === "WAITING" ? { invoiceInboxStatus: "ACTIVE" } : {}),
    },
  });
  return { imported };
}

/** The night's pass: inboxes not read in the last six hours. */
export async function runInboxSync() {
  if (!inboxAvailable()) return { skipped: "openapi non configurato" };
  const due = await prisma.barSettings.findMany({
    where: {
      invoiceInboxStatus: { in: ["WAITING", "ACTIVE"] },
      OR: [{ invoiceInboxSyncedAt: null }, { invoiceInboxSyncedAt: { lt: new Date(Date.now() - 6 * 3_600_000) } }],
    },
    select: { barId: true },
    take: 50,
  });
  let imported = 0;
  for (const { barId } of due) {
    try {
      imported += (await syncInbox(barId)).imported;
    } catch (error) {
      console.error("[costs] inbox sync failed", barId, error instanceof Error ? error.message : error);
    }
  }
  return { venues: due.length, imported };
}
