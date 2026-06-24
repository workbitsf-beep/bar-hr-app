import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    token?: string;
    platform?: string;
  } | null;

  const token = String(body?.token ?? "").trim();
  const platform = String(body?.platform ?? "web").trim().toLowerCase();

  if (!token) {
    return Response.json({ ok: false, message: "Missing token" }, { status: 400 });
  }

  const registered = await prisma.pushToken.upsert({
    where: {
      token,
    },
    update: {
      userId: session.user.id,
      platform,
      lastUsedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      token,
      platform,
      lastUsedAt: new Date(),
    },
    select: {
      id: true,
    },
  });

  return Response.json({
    ok: true,
    pushTokenId: registered.id,
  });
}

export async function DELETE() {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await prisma.pushToken.deleteMany({
    where: {
      userId: session.user.id,
    },
  });

  return Response.json({ ok: true });
}
