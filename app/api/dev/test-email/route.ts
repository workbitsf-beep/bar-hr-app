import { buildEmailTemplate } from "@/lib/email/templates";
import { getEmailAppUrl } from "@/lib/email/notifications";
import { sendEmail } from "@/lib/email/resend";

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

export async function GET(req: Request) {
  const url = new URL(req.url);

  if (!isAuthorized(url)) {
    return Response.json({ ok: false, error: "Not authorized" }, { status: 403 });
  }

  const to = url.searchParams.get("to")?.trim().toLowerCase() ?? "";

  if (!to) {
    return Response.json(
      { ok: false, error: "Parametro 'to' obbligatorio." },
      { status: 400 }
    );
  }

  const result = await sendEmail({
    to,
    subject: "Workbit verifica email",
    html: buildEmailTemplate({
      title: "Verifica email",
      message: `Questa e una email di test inviata da Workbit a ${to}.`,
      ctaLabel: "Apri dashboard",
      ctaUrl: getEmailAppUrl("/dashboard"),
    }),
  });

  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: result.error,
      },
      { status: 503 }
    );
  }

  return Response.json({ ok: true });
}
