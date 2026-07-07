import "server-only";

const INTERNAL_CRON_HEADER = "x-workbit-internal-cron";

function getCronSecret() {
  return process.env.INTERNAL_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
}

export function isAuthorizedCronRequest(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const secret = getCronSecret();

  if (!secret) {
    return false;
  }

  const internalHeader = request.headers.get(INTERNAL_CRON_HEADER)?.trim();
  const authorization = request.headers.get("authorization")?.trim();

  return internalHeader === secret || authorization === `Bearer ${secret}`;
}

export function unauthorizedCronResponse() {
  return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
}
