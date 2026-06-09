import { getFirebasePublicConfig } from "@/lib/firebase-public-config";

export async function GET() {
  const config = getFirebasePublicConfig();

  return Response.json({
    ok: true,
    enabled: Boolean(config),
    config,
  });
}
