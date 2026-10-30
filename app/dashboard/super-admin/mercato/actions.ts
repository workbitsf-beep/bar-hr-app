"use server";

import { revalidatePath } from "next/cache";
import { MARKET_INDEXES } from "@/lib/costs/market";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { getDashboardContext } from "../../context";
import type { ConsoleResult } from "../console-form";

/** A month's market values, as typed: an empty box removes that month's value. */
export async function saveMarketPricesAction(formData: FormData): Promise<ConsoleResult> {
  try {
    const { role } = await getDashboardContext();
    if (String(role) !== "SUPER_ADMIN") throw new RuleError("Solo i super admin.");
    const month = String(formData.get("month") ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RuleError("Mese non valido.");
    let saved = 0;
    for (const index of MARKET_INDEXES) {
      // "9.520,50" and "9520,5" and "2.95" all read as written.
      const raw = String(formData.get(`value_${index.key}`) ?? "").trim().replace(/\s+/g, "");
      const text = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
      await prisma.marketPrice.deleteMany({ where: { indexKey: index.key, month, barId: null } });
      if (!text) continue;
      const value = Number(text);
      if (!Number.isFinite(value) || value <= 0) throw new RuleError(`${index.label}: scrivi un numero, per esempio 2,95.`);
      await prisma.marketPrice.create({ data: { indexKey: index.key, month, value } });
      saved += 1;
    }
    revalidatePath("/dashboard/super-admin/mercato");
    return { ok: true, message: `${saved} valori salvati per ${month}.` };
  } catch (error) {
    return ruleFailure(error);
  }
}
