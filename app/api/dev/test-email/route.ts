import { buildEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { getSession } from "@/lib/auth";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await sendEmail({
    to: session.user.email,
    subject: "Workbit verifica email",
    html: buildEmailTemplate({
      title: "Verifica email",
      message: `Ciao ${session.user.firstName},\nQuesta e una email di verifica inviata da Workbit.`,
      ctaLabel: "Apri dashboard",
      ctaUrl: `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/dashboard`,
    }),
  });

  return Response.json({
    ok: true,
    success: result.success,
    errorMessage: result.errorMessage ?? null,
  });
}
