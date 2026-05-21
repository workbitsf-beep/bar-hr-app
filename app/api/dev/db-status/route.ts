import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isDevEndpointEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEV_ENDPOINTS === "true"
  );
}

function describeDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    "";

  try {
    if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
      const host = new URL(databaseUrl).hostname;

      return {
        host,
        connection: host.endsWith(".railway.internal")
          ? "railway-private"
          : host.endsWith(".proxy.rlwy.net")
            ? "railway-public-proxy"
            : "external",
      };
    }

    return {
      host: process.env.PGHOST || "missing",
      connection: process.env.PGHOST?.endsWith(".railway.internal")
        ? "railway-private"
        : "unknown",
    };
  } catch {
    return {
      host: "invalid-url",
      connection: "invalid",
    };
  }
}

export async function GET() {
  if (!isDevEndpointEnabled()) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  return Response.json({
    ok: true,
    database: describeDatabaseUrl(),
    tableCount: tables.length,
    tables: tables.map((table) => table.table_name),
  });
}
