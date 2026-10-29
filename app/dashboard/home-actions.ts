"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { resolveHomeBlocks } from "@/lib/home-blocks";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/** The blocks this person keeps on Oggi, in order; "reset" goes back to the base. */
export async function saveHomeBlocksAction(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const { activeBar, role } = await getActiveBarAccess(session);
    if (!activeBar?.id) throw new Error("No active bar selected");
    const where = { userId_barId: { userId: session.user.id, barId: activeBar.id } };

    if (formData.get("reset")) {
      await prisma.homeLayout.deleteMany({ where: { userId: session.user.id, barId: activeBar.id } });
    } else {
      let saved: unknown = null;
      try {
        saved = JSON.parse(String(formData.get("blocks") ?? "[]"));
      } catch {
        throw new RuleError("Non si è salvato: riprova.");
      }
      if (!Array.isArray(saved)) throw new RuleError("Non si è salvato: riprova.");
      const blocks = resolveHomeBlocks(saved.map(String), role === Role.OWNER ? "owner" : "staff");
      await prisma.homeLayout.upsert({
        where,
        create: { userId: session.user.id, barId: activeBar.id, blocks },
        update: { blocks },
      });
    }
    revalidatePath("/dashboard");
  } catch (error) {
    return ruleFailure(error);
  }
  return { ok: true };
}
