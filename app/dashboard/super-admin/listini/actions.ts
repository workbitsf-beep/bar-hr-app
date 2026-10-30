"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { getDashboardContext } from "../../context";
import type { ConsoleResult } from "../console-form";

export async function deletePriceListAction(formData: FormData): Promise<ConsoleResult> {
  try {
    const { role } = await getDashboardContext();
    if (String(role) !== "SUPER_ADMIN") throw new RuleError("Solo i super admin.");
    const supplierName = String(formData.get("supplierName") ?? "");
    const removed = await prisma.supplierListPrice.deleteMany({ where: { supplierName, barId: null } });
    revalidatePath("/dashboard/super-admin/listini");
    return { ok: true, message: `Listino tolto (${removed.count} prodotti).` };
  } catch (error) {
    return ruleFailure(error);
  }
}
