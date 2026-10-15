import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { sendReactivationEmailOnce } from "@/lib/billing-reactivation";
import { getDashboardContext } from "./context";
import { BillingRequiredState } from "./ui";

/**
 * The stopped venue's page. On the web it links to the subscription; inside
 * the installed app it may not (Apple), so the owner is emailed the link and
 * the page says where to look.
 */
export async function BillingRequired({ role }: { role: string }) {
  return <BillingRequiredState role={role} nativeNotice={await reactivationNotice(role)} />;
}

async function reactivationNotice(role: string) {
  if (role !== Role.OWNER) return null;
  const insideApp = (await cookies()).get("wb-native")?.value === "1";
  if (!insideApp) return null;

  const { session, activeBarId } = await getDashboardContext();
  if (!activeBarId) return null;
  const sentTo = await sendReactivationEmailOnce(activeBarId, session.user.id);

  return sentTo ? (
    <>
      Ti abbiamo mandato un&apos;email a <strong>{sentTo}</strong> per riattivarlo. Se non la trovi, guarda anche
      nella posta indesiderata.
    </>
  ) : (
    <>Ti scriveremo all&apos;email del titolare per riattivarlo.</>
  );
}
