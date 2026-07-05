import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { THEME_COOKIE_NAME, normalizeTheme } from "@/lib/theme";

export async function POST(req: Request) {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { theme?: string } | null;
  const theme = normalizeTheme(body?.theme);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme },
  });

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE_NAME, theme, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return Response.json({ ok: true, theme });
}
