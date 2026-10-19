import "server-only";

import { randomInt } from "node:crypto";
import { fiscalIssuerOf, getCompanyProfile } from "@/lib/company-profile";
import { sendEmail } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { drawCourtesyPdf } from "./courtesy";
import { buildFatturaXml, type FiscalLine } from "./fattura-pa";

/**
 * A test invoice for one venue, end to end but fake: written like a real
 * one with the venue's data, numbered PROVA (outside the real sequence,
 * saved nowhere), sent to Openapi's sandbox SDI - which answers like the real
 * one and delivers nothing - and emailed to the super admin with PDF and XML.
 * No payment, no real invoice. Needs OPENAPI_SDI_SANDBOX_TOKEN.
 */

const SANDBOX = "https://test.sdi.openapi.it";

async function sandbox(method: string, path: string, body?: string, contentType = "application/json") {
  const token = process.env.OPENAPI_SDI_SANDBOX_TOKEN?.trim();
  if (!token) throw new Error("Manca il token della sandbox Openapi (OPENAPI_SDI_SANDBOX_TOKEN).");
  const response = await fetch(`${SANDBOX}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": contentType } : {}) },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: unknown } | null;
  if (!response.ok || json?.success === false) throw new Error(`Sandbox SDI: ${json?.message || `HTTP ${response.status}`}`);
  return json?.data;
}

export async function runTestInvoice(barId: string, sendTo: string) {
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: { name: true, legalName: true, vatNumber: true, addressLine1: true, city: true, postalCode: true, billingProfile: true },
  });
  if (!bar) throw new Error("Locale non trovato.");
  const issuer = fiscalIssuerOf(await getCompanyProfile());
  const profile = bar.billingProfile;

  const customer = {
    businessName: profile?.businessName || bar.legalName || bar.name,
    vatNumber: profile?.vatNumber || bar.vatNumber || "01234567897",
    taxCode: profile?.taxCode ?? null,
    recipientCode: profile?.recipientCode || (profile?.certifiedEmail ? "0000000" : "0000000"),
    certifiedEmail: profile?.certifiedEmail ?? null,
    addressLine1: profile?.addressLine1 || bar.addressLine1 || "Via di prova 1",
    addressLine2: profile?.addressLine2 ?? null,
    city: profile?.city || bar.city || "Milano",
    province: profile?.province || "MI",
    postalCode: profile?.postalCode || bar.postalCode || "20100",
  };
  const lines: FiscalLine[] = [{ description: "Workbit Base - mensile (FATTURA DI PROVA)", amountCents: 2999 }];
  const number = `PROVA/${randomInt(1000, 9999)}`;
  const progressive = `T${Array.from({ length: 4 }, () => "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(34)]).join("")}`;
  const date = new Date();

  const xml = buildFatturaXml({
    issuer,
    recipient: {
      businessName: customer.businessName,
      vatNumber: customer.vatNumber,
      taxCode: customer.taxCode,
      recipientCode: customer.recipientCode,
      certifiedEmail: customer.certifiedEmail,
      street: [customer.addressLine1, customer.addressLine2].filter(Boolean).join(", "),
      postalCode: customer.postalCode,
      city: customer.city,
      province: customer.province,
      countryCode: "IT",
    },
    number,
    progressive,
    date,
    lines,
  });

  // To the sandbox SDI, then its answer: delivered.
  const sent = (await sandbox("POST", "/invoices", xml, "application/xml")) as { uuid?: string } | null;
  const uuid = sent?.uuid;
  if (!uuid) throw new Error("La sandbox non ha restituito l'identificativo della fattura.");
  await sandbox("POST", "/simulate/customer-notification", JSON.stringify({ uuid, notification: "RC" })).catch(() => null);

  const pdf = await drawCourtesyPdf({ number, date, issuer, customer, barName: bar.name, lines, test: true });
  const fileBase = `Workbit-fattura-${number.replace("/", "-")}`;
  const mail = await sendEmail({
    to: sendTo,
    subject: `[PROVA] Fattura Workbit n. ${number} · ${bar.name}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1b26">
<p><strong>Fattura di prova, non valida.</strong> È quella che riceverebbe ${bar.name} dopo un pagamento: PDF da leggere e XML per il commercialista.</p>
<p>Inviata alla sandbox dello SDI (Openapi), che non la recapita a nessuno. Identificativo: ${uuid}.</p></div>`,
    attachments: [
      { filename: `${fileBase}.pdf`, content: pdf },
      { filename: `${fileBase}.xml`, content: Buffer.from(xml, "utf8") },
    ],
  });

  return { number, uuid, customer: customer.businessName, emailed: mail.ok, sendTo };
}
