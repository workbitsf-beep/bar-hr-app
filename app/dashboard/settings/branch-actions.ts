"use server";

import { ActivityType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getActiveBarAccess } from "@/lib/permissions";
import { getVenueEntitlements } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { createBranch } from "@/lib/venue-branches";

/**
 * A restaurant's branches (lib/venue-branches.ts), added and removed by the
 * owner from the main venue's settings.
 */

async function ownerOfMainRestaurant() {
  const session = await getSession();
  if (!session) throw new RuleError("Accedi di nuovo.");
  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new RuleError("Scegli prima il locale.");
  if (role !== Role.OWNER) throw new RuleError("Solo il titolare aggiunge e toglie le sedi.");

  const bar = await prisma.bar.findUnique({
    where: { id: activeBar.id },
    select: { id: true, activityType: true, mainBarId: true, _count: { select: { branches: true } } },
  });
  if (!bar || bar.activityType === ActivityType.COMPANY) throw new RuleError("Le sedi collegate sono per la ristorazione.");
  if (bar.mainBarId) throw new RuleError("Le sedi si aggiungono dal locale principale.");
  return bar;
}

function refresh() {
  for (const path of ["/dashboard", "/dashboard/settings", "/dashboard/super-admin"]) revalidatePath(path);
}

export async function createBranchAction(formData: FormData) {
  try {
    const bar = await ownerOfMainRestaurant();
    const label = String(formData.get("label") ?? "").trim().slice(0, 40);
    if (!label) throw new RuleError("Scrivi come si chiama la sede, per esempio Centro o Via Roma.");

    const { siteLimit } = await getVenueEntitlements(bar.id);
    // The main venue counts as the first site.
    if (bar._count.branches + 1 >= siteLimit) {
      throw new RuleError(
        siteLimit <= 1
          ? "Il piano comprende una sede sola: aggiungine altre dall'abbonamento."
          : `Il piano comprende ${siteLimit} sedi e sono tutte in uso: aggiungine altre dall'abbonamento.`
      );
    }

    const text = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max) || null;
    const branch = await createBranch(bar.id, {
      label,
      addressLine1: text("addressLine1", 160),
      city: text("city", 80),
      postalCode: text("postalCode", 12),
    });
    refresh();
    return { ok: true as const, message: `Sede aggiunta: ${branch.name}. La apri dal selettore in alto.` };
  } catch (error) {
    return ruleFailure(error);
  }
}

export async function deleteBranchAction(formData: FormData) {
  try {
    const bar = await ownerOfMainRestaurant();
    const branchId = String(formData.get("branchId") ?? "");
    const branch = await prisma.bar.findFirst({
      where: { id: branchId, mainBarId: bar.id },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            memberships: { where: { isActive: true, role: { not: Role.OWNER } } },
            shifts: true,
            timeLogs: true,
          },
        },
      },
    });
    if (!branch) throw new RuleError("Sede non trovata.");
    if (branch._count.memberships > 0 || branch._count.shifts > 0 || branch._count.timeLogs > 0) {
      throw new RuleError("Si toglie solo una sede vuota: senza persone, turni e timbrature.");
    }
    await prisma.bar.delete({ where: { id: branch.id } });
    refresh();
    return { ok: true as const, message: `Sede tolta: ${branch.name}.` };
  } catch (error) {
    return ruleFailure(error);
  }
}
