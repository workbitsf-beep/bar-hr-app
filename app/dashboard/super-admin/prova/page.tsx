import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { Empty, Figure, FigureBand, Forbidden, Section } from "../console-ui";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });

/** The pilot's answers, newest first, with what they would pay. */
export default async function PilotAnswersPage() {
  const { role } = await getDashboardContext();
  if (String(role) !== "SUPER_ADMIN") return <Forbidden />;

  const answers = await prisma.pilotFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const bars = await prisma.bar.findMany({ where: { id: { in: [...new Set(answers.map((item) => item.barId))] } }, select: { id: true, name: true, activityType: true } });
  const barOf = new Map(bars.map((bar) => [bar.id, bar]));
  const pays = answers.map((item) => item.wouldPay).filter((value): value is number => value !== null).sort((a, b) => a - b);
  const votes = answers.map((item) => item.recommend).filter((value): value is number => value !== null);
  const median = pays.length ? pays[Math.floor(pays.length / 2)] : null;
  const middle = (values: Array<number | null>) => {
    const list = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
    return list.length ? list[Math.floor(list.length / 2)] : null;
  };
  const dear = middle(answers.map((item) => item.tooExpensive));
  const cheap = middle(answers.map((item) => item.tooCheap));

  return (
    <div className="wbc-page">
      <div className="wbc-page-head">
        <h1 className="wbc-title">Prova gratuita</h1>
        <p className="wbc-desc">Le risposte al questionario «Com&apos;è andata la prova?», dalle Impostazioni del titolare. Scaricale in CSV per il riepilogo.</p>
        <a className="wbc-btn wbc-btn-sm" href="/api/pilot-feedback" style={{ justifySelf: "start" }}>
          Scarica CSV
        </a>
      </div>
      <FigureBand>
        <Figure label="Risposte" value={String(answers.length)} />
        <Figure label="Pagherebbero (mediana)" value={median !== null ? `${median} €/mese` : "–"} />
        <Figure label="Fascia accettabile (mediane)" value={cheap !== null || dear !== null ? `${cheap ?? "?"}–${dear ?? "?"} €` : "–"} />
        <Figure label="Consiglierebbero (media)" value={votes.length ? `${(votes.reduce((sum, vote) => sum + vote, 0) / votes.length).toFixed(1)}/10` : "–"} />
      </FigureBand>
      <Section title="Risposte">
        {answers.length ? (
          <div style={{ display: "grid", gap: 14 }}>
            {answers.map((answer) => {
              const bar = barOf.get(answer.barId);
              return (
                <article key={answer.id} style={{ border: "1px solid #ece9f6", borderRadius: 16, padding: "14px 16px", display: "grid", gap: 6, fontSize: 14.5 }}>
                  <b>
                    {bar?.name ?? "Locale"} · {date.format(answer.createdAt)}
                    {answer.wouldPay !== null ? ` · ${answer.wouldPay} €/mese` : ""}
                    {answer.tooCheap !== null || answer.tooExpensive !== null ? ` (fascia ${answer.tooCheap ?? "?"}–${answer.tooExpensive ?? "?"} €)` : ""}
                    {answer.recommend !== null ? ` · ${answer.recommend}/10` : ""}
                  </b>
                  {answer.mostUsed ? <span>Usa di più: {answer.mostUsed}</span> : null}
                  {answer.strengths ? <span>👍 {answer.strengths}</span> : null}
                  {answer.problems ? <span>👎 {answer.problems}</span> : null}
                  {answer.missing ? <span>➕ {answer.missing}</span> : null}
                  {answer.payNote ? <span>💶 {answer.payNote}</span> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty>Nessuna risposta ancora. Il questionario è in Impostazioni › «Com&apos;è andata la prova?».</Empty>
        )}
      </Section>
    </div>
  );
}
