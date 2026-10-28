import { Role } from "@prisma/client";
import { createDownloadTicket } from "@/lib/download-tickets";
import { sendEmail } from "@/lib/email/resend";
import { buildEmailTemplate } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { buildPayrollMonth, payrollCsv, payrollFileName, payrollWorkbook } from "@/lib/payroll/consultant-export";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { withBar } from "@/lib/withBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  month?: number;
  year?: number;
  format?: "xlsx" | "csv";
  /** "link" inside the app, which cannot save a file handed to it. */
  deliver?: "file" | "link";
  /** Sends both files to the consultant instead of downloading them. */
  send?: boolean;
};

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

/** The month's attendance for the labour consultant: Excel, CSV, or both by email. */
export const POST = withBar(async (request, session) => {
  const access = await getActiveBarAccess(session as never);
  const barId = access.activeBar?.id;
  if (!barId || (access.role !== Role.OWNER && !can(access.staff, "reports"))) {
    return Response.json({ ok: false, message: "Non puoi scaricare le presenze di questo locale." }, { status: 403 });
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  const month = Number(body.month);
  const year = Number(body.year);
  if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
    return Response.json({ ok: false, message: "Mese non valido." }, { status: 400 });
  }

  const data = await buildPayrollMonth({ barId, month, year, memberWhere: memberScopeWhere(access.staff) });
  if (!data.people.length) {
    return Response.json({ ok: false, message: "Nessuna persona da esportare per questo mese." }, { status: 404 });
  }

  if (body.send) {
    const settings = await prisma.barSettings.findUnique({ where: { barId }, select: { consultantEmail: true, consultantName: true } });
    if (!settings?.consultantEmail) {
      return Response.json({ ok: false, message: "Scrivi prima l'email del consulente." }, { status: 400 });
    }
    const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
    const venue = data.legalName || data.venueName;
    const sender = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim();
    const result = await sendEmail({
      to: settings.consultantEmail,
      replyTo: session.user.email,
      subject: `Presenze ${monthName} · ${venue}`,
      html: buildEmailTemplate({
        title: `Presenze di ${monthName}`,
        message: `${settings.consultantName ? `Buongiorno ${settings.consultantName},\n\n` : ""}in allegato le presenze di ${monthName} di ${venue}${data.vatNumber ? ` (P.IVA ${data.vatNumber})` : ""}: ${data.people.length} ${data.people.length === 1 ? "persona" : "persone"}.\n\nNel file Excel trova il riepilogo, il foglio presenze giorno per giorno e il tracciato; il CSV ha le stesse righe del tracciato, da importare nel programma paghe.\n\nPer rispondere scriva a ${session.user.email}${sender ? ` (${sender})` : ""}.`,
      }),
      attachments: [
        { filename: payrollFileName(data, "xlsx"), content: await payrollWorkbook(data) },
        { filename: payrollFileName(data, "csv"), content: Buffer.from(payrollCsv(data), "utf8") },
      ],
    });
    if (!result.ok) {
      return Response.json({ ok: false, message: "Email non partita. Riprova o scarica il file." }, { status: 502 });
    }
    return Response.json({ ok: true, sentTo: settings.consultantEmail });
  }

  const format = body.format === "csv" ? "csv" : "xlsx";
  const bytes = format === "csv" ? Buffer.from(payrollCsv(data), "utf8") : await payrollWorkbook(data);
  const fileName = payrollFileName(data, format);
  if (body.deliver === "link") {
    const url = await createDownloadTicket({ userId: session.user.id, fileName, mimeType: MIME[format], content: bytes });
    return Response.json({ ok: true, url, fileName });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});
