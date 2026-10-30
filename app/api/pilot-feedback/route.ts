import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The pilot's answers as a CSV for Excel, super admins only. */
export async function GET() {
  const session = await getSession();
  if (!session || String(session.user.role) !== "SUPER_ADMIN") return new Response("Non autorizzato.", { status: 403 });
  const answers = await prisma.pilotFeedback.findMany({ orderBy: { createdAt: "asc" } });
  const bars = await prisma.bar.findMany({ where: { id: { in: [...new Set(answers.map((item) => item.barId))] } }, select: { id: true, name: true, activityType: true } });
  const barOf = new Map(bars.map((bar) => [bar.id, bar]));
  const cell = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [
    ["Data", "Attività", "Tipo", "Usa di più", "Punti di forza", "Cosa non va", "Cosa manca", "Pagherebbe €/mese", "Nota sul prezzo", "Consiglierebbe 0-10"].join(";"),
    ...answers.map((answer) =>
      [
        answer.createdAt.toISOString().slice(0, 10),
        barOf.get(answer.barId)?.name ?? "",
        barOf.get(answer.barId)?.activityType === "COMPANY" ? "Azienda" : "Ristorazione",
        answer.mostUsed,
        answer.strengths,
        answer.problems,
        answer.missing,
        answer.wouldPay,
        answer.payNote,
        answer.recommend,
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  return new Response(`﻿${rows.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="workbit-prova-risposte.csv"', "Cache-Control": "private, no-store" },
  });
}
