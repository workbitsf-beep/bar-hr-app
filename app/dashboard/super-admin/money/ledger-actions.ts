"use server";

import { LedgerKind, LedgerPeriod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { debtRemainingCents, formatCents, parseEuroCents } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/**
 * Workbit's own books, written from the console: entries (running costs,
 * expenses, debts, extra income) and the payments made on debts. Super admin
 * only; each action says what it saved.
 */

const PATH = "/dashboard/super-admin/money/costs";

async function superAdmin() {
  const session = await getSession();
  if (!session || String(session.user.role) !== "SUPER_ADMIN") throw new RuleError("Solo il super admin tiene i conti.");
  return session;
}

function parseDay(value: FormDataEntryValue | null, required: boolean, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (required) throw new RuleError(`Scegli ${label}.`);
    return null;
  }
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new RuleError(`${label[0].toUpperCase()}${label.slice(1)} non è una data valida.`);
  return date;
}

const KIND_WORD: Record<LedgerKind, string> = {
  COST: "Costo",
  EXPENSE: "Spesa",
  DEBT: "Debito",
  INCOME: "Entrata",
};

export async function saveLedgerEntryAction(formData: FormData) {
  try {
    await superAdmin();
    const id = String(formData.get("id") ?? "").trim() || null;
    const kindRaw = String(formData.get("kind") ?? "");
    const kind = (Object.values(LedgerKind) as string[]).includes(kindRaw) ? (kindRaw as LedgerKind) : null;
    if (!kind) throw new RuleError("Scegli che voce è: costo, spesa, debito o entrata.");

    const name = String(formData.get("name") ?? "").trim().slice(0, 80);
    if (!name) throw new RuleError("Scrivi il nome della voce.");

    const amountCents = parseEuroCents(formData.get("amount"));
    if (amountCents === null || amountCents === 0) throw new RuleError("Scrivi l'importo, per esempio 20 o 1.250,50.");

    const periodRaw = String(formData.get("period") ?? "MONTHLY");
    const period =
      kind === "EXPENSE" || kind === "DEBT"
        ? LedgerPeriod.ONCE
        : periodRaw === "YEARLY"
          ? LedgerPeriod.YEARLY
          : periodRaw === "ONCE"
            ? LedgerPeriod.ONCE
            : LedgerPeriod.MONTHLY;

    const startsOn = parseDay(formData.get("startsOn"), true, kind === "EXPENSE" ? "la data" : "da quando");
    const endsOn = parseDay(formData.get("endsOn"), false, "la fine");
    if (startsOn && endsOn && endsOn < startsOn) throw new RuleError("La fine deve essere dopo l'inizio.");

    const installmentCents = kind === "DEBT" ? parseEuroCents(formData.get("installment")) : null;
    const dueOn = kind === "DEBT" ? parseDay(formData.get("dueOn"), false, "la scadenza") : null;
    if (kind === "DEBT" && !installmentCents && !dueOn) {
      throw new RuleError("Per un debito indica la rata mensile, la scadenza, o tutte e due.");
    }

    const data = {
      kind,
      name,
      note: String(formData.get("note") ?? "").trim().slice(0, 200) || null,
      amountCents,
      period,
      startsOn: startsOn as Date,
      endsOn: kind === "COST" || kind === "INCOME" ? endsOn : null,
      installmentCents: installmentCents || null,
      dueOn,
    };

    if (id) {
      await prisma.ledgerEntry.update({ where: { id }, data });
    } else {
      await prisma.ledgerEntry.create({ data });
    }
    revalidatePath(PATH);
    const feminine = kind === "EXPENSE" || kind === "INCOME";
    const verb = id ? (feminine ? "aggiornata" : "aggiornato") : feminine ? "aggiunta" : "aggiunto";
    return { ok: true as const, message: `${KIND_WORD[kind]} ${verb}: ${name}, ${formatCents(amountCents)}.` };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function deleteLedgerEntryAction(formData: FormData) {
  try {
    await superAdmin();
    const id = String(formData.get("id") ?? "");
    const entry = await prisma.ledgerEntry.delete({ where: { id }, select: { name: true } }).catch(() => null);
    if (!entry) throw new RuleError("Questa voce non c'è più.");
    revalidatePath(PATH);
    return { ok: true as const, message: `${entry.name} eliminata.` };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** A payment on a debt: the installment, or what is left when less, or the whole bill. */
export async function payLedgerDebtAction(formData: FormData) {
  try {
    await superAdmin();
    const id = String(formData.get("id") ?? "");
    const entry = await prisma.ledgerEntry.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        name: true,
        amountCents: true,
        installmentCents: true,
        period: true,
        startsOn: true,
        endsOn: true,
        dueOn: true,
        payments: { select: { amountCents: true, paidOn: true } },
      },
    });
    if (!entry || entry.kind !== LedgerKind.DEBT) throw new RuleError("Debito non trovato.");
    const remaining = debtRemainingCents({ ...entry, kind: "DEBT" });
    if (remaining <= 0) throw new RuleError(`${entry.name} è già saldato.`);

    const typed = parseEuroCents(formData.get("amount"));
    const amountCents = Math.min(remaining, typed ?? entry.installmentCents ?? remaining);
    const paidOn = parseDay(formData.get("paidOn"), false, "la data") ?? new Date();

    await prisma.ledgerPayment.create({ data: { entryId: entry.id, amountCents, paidOn } });
    revalidatePath(PATH);
    const left = remaining - amountCents;
    return {
      ok: true as const,
      message: left > 0 ? `Pagati ${formatCents(amountCents)} di ${entry.name}: restano ${formatCents(left)}.` : `${entry.name} saldato.`,
    };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function deleteLedgerPaymentAction(formData: FormData) {
  try {
    await superAdmin();
    const id = String(formData.get("id") ?? "");
    const payment = await prisma.ledgerPayment.delete({ where: { id }, select: { amountCents: true } }).catch(() => null);
    if (!payment) throw new RuleError("Questo pagamento non c'è più.");
    revalidatePath(PATH);
    return { ok: true as const, message: `Pagamento di ${formatCents(payment.amountCents)} annullato.` };
  } catch (error) {
    return ruleFailure(error);
  }
}
