import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * The venue's logo, for the header. The URL carries the logo's version
 * (?v=), so the browser may keep it for good: a new logo is a new URL.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ barId: string }> }) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  const { barId } = await params;
  const bar = await prisma.bar.findUnique({ where: { id: barId }, select: { logo: true, logoType: true } });
  if (!bar?.logo || !bar.logoType) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(bar.logo), {
    headers: {
      "Content-Type": bar.logoType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
