import "server-only";

import { gunzipSync } from "node:zlib";
import { monthLabel } from "@/lib/costs/analysis";
import { buildEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { buildZip } from "@/lib/zip-write";
import { appUrl } from "./auth";

/**
 * What an accountant can take: the supplier invoices of the venues that
 * added their email, as the original XML files, one zip per month - for one
 * venue or all of them at once. A month is the invoice's date.
 */

export type AccountantVenue = { id: string; name: string; months: { month: string; count: number }[] };

function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, mon - 1, 1)), end: new Date(Date.UTC(year, mon, 1)) };
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function venueName(bar: { name: string | null; legalName: string | null }) {
  return bar.name || bar.legalName || "Locale";
}

/** The venues of this email, each with the months that have invoices (newest first, last 24). */
export async function venuesForAccountant(email: string): Promise<AccountantVenue[]> {
  const accesses = await prisma.accountantAccess.findMany({
    where: { email },
    select: { bar: { select: { id: true, name: true, legalName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 24, 1);

  return Promise.all(
    accesses.map(async ({ bar }) => {
      const dates = await prisma.supplierInvoice.findMany({
        where: { barId: bar.id, issueDate: { gte: since } },
        select: { issueDate: true },
      });
      const counts = new Map<string, number>();
      for (const { issueDate } of dates) counts.set(monthKey(issueDate), (counts.get(monthKey(issueDate)) ?? 0) + 1);
      return {
        id: bar.id,
        name: venueName(bar),
        months: [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, count]) => ({ month, count })),
      };
    }),
  );
}

/** The venues among `barIds` (all, when left out) that this email may read. */
export async function allowedBars(email: string, barIds?: string[]) {
  const rows = await prisma.accountantAccess.findMany({
    where: { email, ...(barIds ? { barId: { in: barIds } } : {}) },
    select: { barId: true, bar: { select: { name: true, legalName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({ id: row.barId, name: venueName(row.bar) }));
}

function safeName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "x"
  );
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function euro(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * The month's zip: per venue the XML files and a riepilogo.csv (date,
 * supplier, VAT number, number, type, taxable, VAT, total). With more than
 * one venue each has its own folder.
 */
export async function buildAccountantZip(venues: { id: string; name: string }[], month: string) {
  const { start, end } = monthRange(month);
  const entries: { name: string; data: Buffer }[] = [];
  let count = 0;

  for (const venue of venues) {
    const folder = venues.length > 1 ? `${safeName(venue.name)}/` : "";
    const invoices = await prisma.supplierInvoice.findMany({
      where: { barId: venue.id, issueDate: { gte: start, lt: end } },
      orderBy: [{ issueDate: "asc" }, { supplierName: "asc" }],
      select: {
        docType: true,
        supplierName: true,
        supplierVat: true,
        number: true,
        issueDate: true,
        taxableCents: true,
        vatCents: true,
        totalCents: true,
        xmlGz: true,
      },
    });
    const used = new Set<string>();
    const rows = [["Data", "Fornitore", "Partita IVA", "Numero", "Tipo", "Imponibile", "IVA", "Totale", "File"].join(";")];

    for (const invoice of invoices) {
      const date = invoice.issueDate.toISOString().slice(0, 10);
      const base = `${date}_${safeName(invoice.supplierName)}_${safeName(invoice.number)}`;
      let file = `${base}.xml`;
      for (let n = 2; used.has(file); n += 1) file = `${base}_${n}.xml`;
      used.add(file);
      if (invoice.xmlGz) {
        entries.push({ name: `${folder}${file}`, data: gunzipSync(Buffer.from(invoice.xmlGz)) });
        count += 1;
      }
      rows.push(
        [
          date,
          invoice.supplierName,
          invoice.supplierVat ?? "",
          invoice.number,
          invoice.docType,
          euro(invoice.taxableCents),
          euro(invoice.vatCents),
          euro(invoice.totalCents),
          invoice.xmlGz ? file : "",
        ]
          .map(csvCell)
          .join(";"),
      );
    }
    // A BOM, so Excel opens the accents right.
    entries.push({ name: `${folder}riepilogo.csv`, data: Buffer.from(`﻿${rows.join("\r\n")}\r\n`, "utf8") });
  }

  const label = venues.length === 1 ? safeName(venues[0].name) : "tutti-i-locali";
  return { fileName: `fatture-${label}-${month}.zip`, content: buildZip(entries), count };
}

/** The mail an owner's "add" sends: where to go and how to sign in. */
export async function sendAccountantInvite(email: string, venue: string, owner: string) {
  return sendEmail({
    to: email,
    subject: `${venue} ti dà accesso alle sue fatture su Workbit`,
    html: buildEmailTemplate({
      title: "Le fatture dei fornitori, pronte da scaricare",
      message: `${owner} di ${venue} ti ha dato accesso alle fatture dei fornitori su Workbit.\nEntri con questa email e un codice che ti mandiamo, senza password. Vedi in una lista sola tutti i tuoi clienti che usano Workbit e scarichi lo zip del mese, con gli XML e un riepilogo.`,
      ctaLabel: "Apri le fatture",
      ctaUrl: `${appUrl()}/commercialista`,
    }),
  });
}

/**
 * From the 2nd of the month, 9:00 in Italy: each accountant is told once
 * that last month's invoices are ready, one mail listing all their venues.
 */
export async function runAccountantNotices(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  if (Number(parts.day) < 2 || Number(parts.hour) < 9) return { notified: 0 };
  const key = monthKey(new Date(Date.UTC(Number(parts.year), Number(parts.month) - 2, 1)));
  const { start, end } = monthRange(key);

  const [accesses, done] = await Promise.all([
    prisma.accountantAccess.findMany({ select: { email: true, barId: true, bar: { select: { name: true, legalName: true } } } }),
    prisma.accountantNotice.findMany({ where: { notifiedMonth: key }, select: { email: true } }),
  ]);
  const notifiedAlready = new Set(done.map((row) => row.email));
  const byEmail = new Map<string, { barId: string; name: string }[]>();
  for (const access of accesses) {
    if (notifiedAlready.has(access.email)) continue;
    byEmail.set(access.email, [...(byEmail.get(access.email) ?? []), { barId: access.barId, name: venueName(access.bar) }]);
  }

  let notified = 0;
  for (const [email, venues] of [...byEmail.entries()].slice(0, 100)) {
    const counts = await Promise.all(
      venues.map((venue) => prisma.supplierInvoice.count({ where: { barId: venue.barId, issueDate: { gte: start, lt: end } } })),
    );
    await prisma.accountantNotice.upsert({ where: { email }, create: { email, notifiedMonth: key }, update: { notifiedMonth: key } });
    const lines = venues.flatMap((venue, index) => (counts[index] ? [`${venue.name}: ${counts[index]} fatture`] : []));
    if (!lines.length) continue;
    await sendEmail({
      to: email,
      subject: `Fatture di ${monthLabel(key)} pronte su Workbit`,
      html: buildEmailTemplate({
        title: `Fatture di ${monthLabel(key)}`,
        message: `${lines.join("\n")}\n\nLe scarichi in uno zip, un locale alla volta o tutti insieme.`,
        ctaLabel: "Scarica le fatture",
        ctaUrl: `${appUrl()}/commercialista`,
      }),
    }).catch((error) => console.error("[accountant] notice not sent", error instanceof Error ? error.message : error));
    notified += 1;
  }
  return { notified };
}
