import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPostLoginDestination } from "@/lib/permissions";
import { hasTerminalCookie } from "@/lib/terminal/terminal";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    // The venue's terminal opens straight on its screen.
    redirect((await hasTerminalCookie()) ? "/terminale" : "/login");
  }

  redirect(
    await getPostLoginDestination({
      userId: session.user.id,
      role: session.user.role,
      mustChangePwd: session.user.mustChangePwd,
      activeBarId: session.activeBarId,
    })
  );
}
