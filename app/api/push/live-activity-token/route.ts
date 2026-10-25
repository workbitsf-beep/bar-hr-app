import { getSession } from "@/lib/auth";
import { LIVE_ACTIVITY_PLATFORM } from "@/lib/live-activity";
import { prisma } from "@/lib/prisma";

/**
 * The iPhone's push-to-start token for the shift's Live Activity
 * (lib/live-activity.ts): one per person, the latest phone wins.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = String(body?.token ?? "").trim();
  if (!/^[0-9a-f]{32,400}$/i.test(token)) {
    return Response.json({ ok: false, message: "Token non valido" }, { status: 400 });
  }

  await prisma.pushToken.upsert({
    where: { token },
    update: { userId: session.user.id, platform: LIVE_ACTIVITY_PLATFORM, lastUsedAt: new Date() },
    create: { userId: session.user.id, token, platform: LIVE_ACTIVITY_PLATFORM, lastUsedAt: new Date() },
  });
  await prisma.pushToken.deleteMany({
    where: { userId: session.user.id, platform: LIVE_ACTIVITY_PLATFORM, token: { not: token } },
  });

  return Response.json({ ok: true });
}
