"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getActiveBarAccess } from "@/lib/permissions";
import { getVenueEntitlements, parseSignFont } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/**
 * The venue's own style: its logo in the header and its sign font. The
 * Stile extra on Base, included in Pro. Owner only.
 */

/** The phone already crops and shrinks the logo; this is only the ceiling. */
const MAX_LOGO_BYTES = 300 * 1024;

function imageType(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function saveVenueStyleAction(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const { activeBar, role } = await getActiveBarAccess(session);
    if (!activeBar?.id) throw new Error("No active bar selected");
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") throw new RuleError("Solo il titolare cambia lo stile del locale.");
    if (!(await getVenueEntitlements(activeBar.id)).branding) {
      throw new RuleError("Logo e font sono l'extra Stile del Base, e sono compresi nel Pro.");
    }

    const data: { signFont?: string | null; logo?: Uint8Array<ArrayBuffer> | null; logoType?: string | null; logoUpdatedAt?: Date | null } = {};

    if (formData.has("signFont")) {
      data.signFont = parseSignFont(formData.get("signFont"));
    }

    if (formData.get("removeLogo") === "1") {
      data.logo = null;
      data.logoType = null;
      data.logoUpdatedAt = new Date();
    } else {
      const file = formData.get("logo");
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_LOGO_BYTES) throw new RuleError("Il logo è troppo pesante: usane uno più piccolo.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const type = imageType(bytes);
        if (!type) throw new RuleError("Il logo deve essere un'immagine PNG, JPG o WebP.");
        data.logo = bytes;
        data.logoType = type;
        data.logoUpdatedAt = new Date();
      }
    }

    await prisma.bar.update({ where: { id: activeBar.id }, data });
    revalidatePath("/dashboard", "layout");
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}
