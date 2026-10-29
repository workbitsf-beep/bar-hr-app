import { createDownloadTicket } from "@/lib/download-tickets";
import { sendEmail } from "@/lib/email/resend";
import { buildEmailTemplate } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import { emailList, monthKeyOf, payrollAccess } from "@/lib/payroll/access";
import { buildPayrollMonth, payrollFile } from "@/lib/payroll/consultant-export";
import { defaultTemplate, templateOf } from "@/lib/payroll/template";
import { describeActionError } from "@/lib/rule-error";
import { memberScopeWhere } from "@/lib/staff-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  month?: number;
  year?: number;
  recipientId?: string;
  /**
   * download: the file itself, in a browser; link: a one-time link, inside
   * the app (a web view cannot save a file); compose: the file as base64,
   * for the phone's mail composer; workbit: Workbit sends the mail.
   */
  mode?: "download" | "link" | "compose" | "workbit";
  to?: string;
  cc?: string;
  subject?: string;
  text?: string;
};

/** The month's attendance in the file a recipient wants, or sent to them. */
export async function POST(request: Request) {
  let access: Awaited<ReturnType<typeof payrollAccess>>;
  try {
    access = await payrollAccess();
  } catch (error) {
    return Response.json({ ok: false, message: describeActionError(error) }, { status: 403 });
  }
  const { barId, staff, session } = access;

  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  const month = Number(body.month);
  const year = Number(body.year);
  if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
    return Response.json({ ok: false, message: "Mese non valido." }, { status: 400 });
  }

  const recipient = body.recipientId
    ? await prisma.payrollRecipient.findFirst({ where: { id: body.recipientId, barId } })
    : null;
  if (body.recipientId && !recipient) return Response.json({ ok: false, message: "Destinatario non trovato." }, { status: 404 });
  const template = recipient ? templateOf(recipient.template) : defaultTemplate();

  const data = await buildPayrollMonth({ barId, month, year, memberWhere: memberScopeWhere(staff) });
  if (!data.people.length) {
    return Response.json({ ok: false, message: "Nessuna persona da mandare per questo mese." }, { status: 404 });
  }
  const file = await payrollFile(data, template);
  const mode = body.mode ?? "download";

  if (mode === "compose") {
    return Response.json({ ok: true, files: [{ name: file.fileName, mimeType: file.mimeType, base64: file.content.toString("base64") }] });
  }

  if (mode === "workbit") {
    if (!recipient) return Response.json({ ok: false, message: "Scegli a chi mandarle." }, { status: 400 });
    const to = emailList(body.to || recipient.email);
    if (!to.length) return Response.json({ ok: false, message: "Scrivi l'email del destinatario." }, { status: 400 });
    const cc = Array.from(new Set([...emailList(body.cc ?? recipient.cc), session.user.email.toLowerCase()])).filter((item) => !to.includes(item));
    const subject = (body.subject ?? "").trim().slice(0, 200) || `Presenze ${monthKeyOf(year, month)}`;
    const text = (body.text ?? "").trim().slice(0, 5000);
    const result = await sendEmail({
      to,
      cc,
      replyTo: session.user.email,
      subject,
      html: buildEmailTemplate({ title: subject, message: text }),
      attachments: [{ filename: file.fileName, content: file.content }],
    });
    if (!result.ok) return Response.json({ ok: false, message: "Email non partita. Riprova o scarica il file." }, { status: 502 });
    await prisma.payrollSend.create({
      data: { barId, recipientId: recipient.id, month: monthKeyOf(year, month), channel: "workbit", sentById: session.user.id },
    });
    return Response.json({ ok: true, sentTo: to.join(", ") });
  }

  if (mode === "link") {
    const url = await createDownloadTicket({ userId: session.user.id, fileName: file.fileName, mimeType: file.mimeType, content: file.content });
    return Response.json({ ok: true, url, fileName: file.fileName });
  }
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
