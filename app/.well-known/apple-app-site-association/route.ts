/**
 * The iPhone app's claim on this domain, read by iOS (through Apple's CDN)
 * before it lets the app use the passkeys registered for app.workbit.it -
 * "Sblocca con il telefono". The Android side of the same thing is
 * public/.well-known/assetlinks.json. Team ID from developer.apple.com.
 */
const APP_ID = "CP959544TM.it.workbit.app";

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { webcredentials: { apps: [APP_ID] } },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
