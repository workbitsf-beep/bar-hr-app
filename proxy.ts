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
  // Behind Railway the Host header can carry the internal address, while the
  // name the browser actually used arrives forwarded. Comparing the wrong one
  // made the app bounce requests that were already on the right domain.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!canonicalHost || !host || host === canonicalHost) {
    // Temporary: a request keeps reaching the dashboard with no cookies at
    // all, and a page cannot read its own address. The proxy can, so it writes
    // it down for the session log. Comes out with that log.
    const headers = new Headers(request.headers);
    headers.set("x-workbit-path", request.nextUrl.pathname + request.nextUrl.search);
    headers.set("x-workbit-method", request.method);

    return NextResponse.next({ request: { headers } });
  }

  // Only a page someone is opening should ever be sent elsewhere. Answering a
  // data request with a redirect to another host restarts it without the
  // cookies it was carrying, so the server sees a stranger and returns the
  // login page — which is what flashed after every save.
  const destination = request.headers.get("sec-fetch-dest");

  if (destination && destination !== "document") {
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
  //
  // .well-known is excluded for a different reason: Google reads
  // assetlinks.json from there to decide whether this app may use the site's
  // passkeys, and that check treats a redirect as a failure rather than
  // following it.
  matcher: ["/((?!api|\\.well-known|_next/static|_next/image|favicon.ico).*)"],
};
