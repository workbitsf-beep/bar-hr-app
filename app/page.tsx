import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPostLoginDestination } from "@/lib/permissions";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  redirect(
    await getPostLoginDestination({
      userId: session.user.id,
      role: session.user.role,
      mustChangePwd: session.user.mustChangePwd,
    })
  );
}
