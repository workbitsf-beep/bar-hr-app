import {
  sendEmployeeWelcomeEmail,
  sendOwnerWelcomeEmail,
} from "@/lib/email/notifications";

function isAuthorized(url: URL) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const secret = process.env.DEV_SECRET?.trim();

  if (!secret) {
    return false;
  }

  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isAuthorized(url)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const to = url.searchParams.get("to")?.trim().toLowerCase() ?? "";
  const type = url.searchParams.get("type")?.trim().toLowerCase() ?? "owner";

  if (!to) {
    return Response.json({ ok: false, error: "Missing recipient" }, { status: 400 });
  }

  if (type !== "owner" && type !== "employee") {
    return Response.json({ ok: false, error: "Invalid welcome email type" }, { status: 400 });
  }

  const result =
    type === "owner"
      ? await sendOwnerWelcomeEmail(
          to,
          "Titolare Demo",
          "Locale Demo",
          to,
          "TempPass123!"
        )
      : await sendEmployeeWelcomeEmail(
          to,
          "Dipendente Demo",
          "Locale Demo",
          to,
          "TempPass123!"
        );

  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        type,
        error: result.error,
      },
      { status: 503 }
    );
  }

  return Response.json({ ok: true, type });
}
