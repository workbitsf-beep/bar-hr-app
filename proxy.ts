import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends every request to the host the app currently considers canonical.
 *
 * The canonical host is read from APP_URL at request time, so the direction of
 * the redirect flips by itself the moment that variable is updated: while
 * APP_URL still points at the old Railway address nothing changes for existing
 * users, and as soon as it names the custom domain the old address starts
 * forwarding there instead.
 */
function getCanonicalHost() {
  const configured = process.env.APP_URL?.trim();

  if (!configured) {
    return null;
  }

  try {
    return new URL(configured).host;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const canonicalHost = getCanonicalHost();
  const host = request.headers.get("host");

  if (!canonicalHost || !host || host === canonicalHost) {
    return NextResponse.next();
  }

  const target = request.nextUrl.clone();
  target.protocol = "https:";
  target.host = canonicalHost;
  target.port = "";
  // Lets the landing page tell people their home screen icon still points at
  // the old address and should be added again.
  target.searchParams.set("moved", "1");

  // Deliberately temporary: browsers cache a permanent redirect aggressively,
  // which would make this migration painful to reverse.
  return NextResponse.redirect(target, 307);
}

export const config = {
  // Never touch API routes: the Railway healthcheck and the Stripe webhook are
  // both POSTed to fixed URLs that must answer directly, not redirect.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
