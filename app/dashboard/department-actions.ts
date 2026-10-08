"use server";

import { ChecklistMoment, Department, DepartmentMode, Role, VenuePlan } from "@prisma/client";
import { getVenueEntitlements, MAX_SEAT_PACKS, siteLimitOf } from "@/lib/plans";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { checklistDay, parseChecklistItems } from "@/lib/checklists";
import { getVenueDepartments, isSiteSlot, parseDepartment, SITE_SLOTS } from "@/lib/departments";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/**
 * Departments: the owner's settings, a person's department, and the switch
 * the super admin uses to put a venue on Pro while prices are being decided.
 */

async function ownerOfProVenue() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new Error("No active bar selected");
  if (role !== Role.OWNER && role !== Role.MANAGER && String(role) !== "SUPER_ADMIN") throw new Error("Unauthorized");

  const entitlements = await getVenueEntitlements(activeBar.id);
  if (!entitlements.departments) throw new RuleError("Reparti e sedi sono un extra del Base, e sono compresi nel Pro.");

  return { barId: activeBar.id, role, entitlements, activityType: activeBar.activityType };
}

function refresh() {
  for (const path of ["/dashboard", "/dashboard/calendar", "/dashboard/people", "/dashboard/settings"]) {
    revalidatePath(path);
  }
}

/** Calendar mode and the owner's own department. Owner only. */
export async function updateDepartmentSettingsAction(formData: FormData) {
  try {
    const { barId, role } = await ownerOfProVenue();
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") throw new RuleError("Solo il titolare cambia i reparti.");

    const mode = String(formData.get("mode")) === DepartmentMode.SEPARATE ? DepartmentMode.SEPARATE : DepartmentMode.UNIFIED;
    const customName = String(formData.get("customName") ?? "").trim().slice(0, 18) || null;

    if (customName && ["banco", "cucina", "sala", "jolly"].includes(customName.toLowerCase())) {
      throw new RuleError(`${customName} c'è già.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.bar.update({ where: { id: barId }, data: { departmentMode: mode, customDepartmentName: customName } });

      // Taking the fourth department away leaves nobody and nothing in it.
      if (!customName) {
        await tx.employeeBar.updateMany({
          where: { barId, department: Department.CUSTOM },
          data: { department: null, isDepartmentLead: false },
        });
        const helping = await tx.employeeBar.findMany({
          where: { barId, helpsIn: { has: Department.CUSTOM } },
          select: { id: true, helpsIn: true },
        });
        for (const member of helping) {
          await tx.employeeBar.update({
            where: { id: member.id },
            data: { helpsIn: member.helpsIn.filter((entry) => entry !== Department.CUSTOM) },
          });
        }
        await tx.shift.updateMany({ where: { barId, department: Department.CUSTOM }, data: { department: null } });
      }
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Where a person works, where they can help, and whether they lead it. */
export async function updateMemberDepartmentAction(formData: FormData) {
  try {
    const { barId } = await ownerOfProVenue();
    const membershipId = String(formData.get("membershipId") ?? "");
    const department = parseDepartment(formData.get("department"));
    const helpsIn = formData
      .getAll("helpsIn")
      .map((value) => parseDepartment(value))
      .filter((value): value is Department => Boolean(value) && value !== department);
    const isLead = Boolean(department) && formData.get("isLead") === "on";

    const membership = await prisma.employeeBar.findFirst({
      where: { id: membershipId, barId, isActive: true },
      select: { id: true, role: true },
    });
    if (!membership) throw new RuleError("Persona non trovata in questo locale.");

    await prisma.$transaction(async (tx) => {
      // One lead per department: naming a new one hands the role over.
      if (isLead && department) {
        await tx.employeeBar.updateMany({
          where: { barId, department, isDepartmentLead: true, id: { not: membership.id } },
          data: { isDepartmentLead: false },
        });
      }
      await tx.employeeBar.update({
        where: { id: membership.id },
        data: {
          department,
          helpsIn: Array.from(new Set(helpsIn)),
          isDepartmentLead: membership.role === Role.OWNER ? false : isLead,
        },
      });
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

/**
 * The venue's plan and extras. Super admin only, until checkout sells them:
 * Base or Pro, and on Base the departments, the packs of five more people
 * and the venue's own style.
 */
export async function setVenuePlanAction(formData: FormData) {
  const session = await getSession();
  if (!session || String(session.user.role) !== "SUPER_ADMIN") throw new Error("Unauthorized");

  const barId = String(formData.get("barId") ?? "");
  const plan = String(formData.get("plan")) === VenuePlan.PRO ? VenuePlan.PRO : VenuePlan.BASE;
  const packs = Math.max(0, Math.min(MAX_SEAT_PACKS, Math.round(Number(formData.get("extraSeatPacks") ?? 0) || 0)));

  await prisma.bar.update({
    where: { id: barId },
    data: {
      plan,
      departmentsAddon: formData.get("departmentsAddon") === "on",
      extraSeatPacks: packs,
      brandingAddon: formData.get("brandingAddon") === "on",
    },
  });
  revalidatePath(`/dashboard/super-admin/bar/${barId}`);
  refresh();
}

/** Owner: the opening and closing lines of one department, one per line. */
export async function saveChecklistAction(formData: FormData) {
  try {
    const { barId, role } = await ownerOfProVenue();
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") throw new RuleError("Solo il titolare scrive le checklist.");

    const department = parseDepartment(formData.get("department"));
    if (!department) throw new RuleError("Scegli il reparto.");

    for (const moment of [ChecklistMoment.OPENING, ChecklistMoment.CLOSING]) {
      const items = parseChecklistItems(String(formData.get(moment) ?? ""));
      await prisma.checklist.upsert({
        where: { barId_department_moment: { barId, department, moment } },
        update: { items },
        create: { barId, department, moment, items },
      });
    }

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

/**
 * Ticks or unticks one line of today's checklist. Anyone who works in the
 * department, or helps there, can; the owner and managers too. The last tick
 * records who closed the list and when.
 */
export async function toggleChecklistItemAction(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const { activeBar, role } = await getActiveBarAccess(session);
    if (!activeBar?.id) throw new Error("No active bar selected");

    const checklistId = String(formData.get("checklistId") ?? "");
    const item = String(formData.get("item") ?? "");
    const checked = formData.get("checked") === "on";

    const checklist = await prisma.checklist.findFirst({
      where: { id: checklistId, barId: activeBar.id },
      select: { id: true, department: true, items: true },
    });
    if (!checklist || !checklist.items.includes(item)) throw new RuleError("Questa voce non c'è più.");

    const departments = await getVenueDepartments(activeBar.id, session.user.id);
    const runsAll = role === Role.OWNER || role === Role.MANAGER || String(role) === "SUPER_ADMIN";
    const worksThere =
      departments.mine.department === checklist.department || departments.mine.helpsIn.includes(checklist.department);
    if (!departments.enabled || (!runsAll && !worksThere)) throw new RuleError("Non lavori in questo reparto.");

    const day = checklistDay();
    const run = await prisma.checklistRun.findUnique({
      where: { checklistId_day: { checklistId, day } },
      select: { doneItems: true },
    });
    const done = new Set((run?.doneItems ?? []).filter((entry) => checklist.items.includes(entry)));
    if (checked) done.add(item);
    else done.delete(item);
    const complete = checklist.items.every((entry) => done.has(entry));

    await prisma.checklistRun.upsert({
      where: { checklistId_day: { checklistId, day } },
      update: {
        doneItems: Array.from(done),
        completedById: complete ? session.user.id : null,
        completedAt: complete ? new Date() : null,
      },
      create: {
        checklistId,
        day,
        doneItems: Array.from(done),
        completedById: complete ? session.user.id : null,
        completedAt: complete ? new Date() : null,
      },
    });

    revalidatePath("/dashboard");
    return { ok: true as const, complete };
  } catch (error) {
    return ruleFailure(error);
  }
}

/**
 * A company's site: its name, address and the point where its people clock
 * in. New sites take the first free slot, up to the plan's limit (three
 * with the Sedi extra, six on Pro). Owner only.
 */
export async function saveSiteAction(formData: FormData) {
  try {
    const { barId, role, entitlements, activityType } = await ownerOfProVenue();
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") throw new RuleError("Solo il titolare cambia le sedi.");
    if (activityType !== "COMPANY") throw new RuleError("Le sedi sono delle aziende.");

    const name = String(formData.get("name") ?? "").trim().slice(0, 28);
    if (!name) throw new RuleError("Scrivi il nome della sede.");
    const address = String(formData.get("address") ?? "").trim().slice(0, 160) || null;
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));
    const point =
      Number.isFinite(latitude) && Number.isFinite(longitude) && String(formData.get("latitude") ?? "").trim() !== ""
        ? { latitude, longitude }
        : { latitude: null, longitude: null };

    const existing = await prisma.site.findMany({ where: { barId }, select: { slot: true, name: true } });
    const requested = parseDepartment(formData.get("slot"));
    const limit = siteLimitOf(entitlements);

    if (existing.some((site) => site.slot !== requested && site.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new RuleError(`C'è già una sede che si chiama ${name}.`);
    }

    let slot = requested && isSiteSlot(requested) && existing.some((site) => site.slot === requested) ? requested : null;
    if (!slot) {
      if (existing.length >= limit) {
        throw new RuleError(
          limit >= SITE_SLOTS.length
            ? `Il Pro arriva a ${limit} sedi.`
            : `Con l'extra Sedi arrivi a ${limit} sedi; il Pro ne comprende fino a ${SITE_SLOTS.length}.`
        );
      }
      slot = SITE_SLOTS.find((candidate) => !existing.some((site) => site.slot === candidate)) ?? null;
      if (!slot) throw new RuleError("Non ci sono altri posti per le sedi.");
    }

    await prisma.site.upsert({
      where: { barId_slot: { barId, slot } },
      update: { name, address, ...point },
      create: { barId, slot, name, address, ...point },
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** A site closed: nobody works there any more, and no shift from today on is filed under it. */
export async function deleteSiteAction(formData: FormData) {
  try {
    const { barId, role } = await ownerOfProVenue();
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") throw new RuleError("Solo il titolare cambia le sedi.");
    const slot = parseDepartment(formData.get("slot"));
    if (!slot || !isSiteSlot(slot)) throw new RuleError("Sede non trovata.");

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    await prisma.$transaction(async (tx) => {
      await tx.site.deleteMany({ where: { barId, slot } });
      await tx.employeeBar.updateMany({ where: { barId, department: slot }, data: { department: null, isDepartmentLead: false } });
      const helping = await tx.employeeBar.findMany({ where: { barId, helpsIn: { has: slot } }, select: { id: true, helpsIn: true } });
      for (const member of helping) {
        await tx.employeeBar.update({ where: { id: member.id }, data: { helpsIn: member.helpsIn.filter((entry) => entry !== slot) } });
      }
      await tx.shift.updateMany({ where: { barId, department: slot, startTime: { gte: startOfToday } }, data: { department: null } });
      await tx.checklist.deleteMany({ where: { barId, department: slot } });
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}
