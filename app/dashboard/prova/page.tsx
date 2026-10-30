import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { EmptyState, Panel } from "../ui";
import { mixCard, mixPage, PageHead } from "../mix-ui";
import { savePilotFeedbackAction } from "./actions";

export const dynamic = "force-dynamic";

const area: CSSProperties = { width: "100%", minHeight: 96, borderRadius: 14, border: "1px solid #e4e0f3", padding: "10px 12px", fontSize: 15.5, fontFamily: "inherit", lineHeight: 1.45, resize: "vertical", background: "#ffffff" };
const field: CSSProperties = { minHeight: 46, borderRadius: 12, border: "1px solid #e4e0f3", padding: "0 12px", fontSize: 16, background: "#ffffff" };

const PARTS = ["Turni", "Presenze e file del consulente", "Ferie e permessi", "Note e controlli", "Costi e risparmi", "Pagamenti ai fornitori", "Corsi", "Documenti"];

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section style={{ ...mixCard, display: "grid", gap: 8 }}>
      <b style={{ fontSize: 15.5 }}>{title}</b>
      {hint ? <span style={{ fontSize: 13.5, color: "#7c7894", marginTop: -4 }}>{hint}</span> : null}
      {children}
    </section>
  );
}

/**
 * The pilot's questionnaire: what works, what does not, what is missing, how
 * much it is worth. Ten minutes for the owner, the price list for us.
 */
export default async function PilotFeedbackPage() {
  const { role, activeBarId, session } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Com'è andata la prova?">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (role !== Role.OWNER) {
    return (
      <Panel title="Com'è andata la prova?">
        <EmptyState message="Il questionario lo compila il titolare." />
      </Panel>
    );
  }
  const last = await prisma.pilotFeedback.findFirst({ where: { barId: activeBarId, userId: session.user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });

  return (
    <div style={mixPage}>
      <Link href="/dashboard/settings" style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ Impostazioni
      </Link>
      <PageHead title="Com'è andata la prova?" />
      <p style={{ margin: 0, fontSize: 14.5, color: "#4b4763", lineHeight: 1.55, padding: "0 4px" }}>
        Dieci minuti, e Workbit diventa come lo vuoi tu. Leggiamo ogni risposta: scrivi come parleresti a noi, anche poche parole.
        {last ? ` Ci hai già risposto il ${last.createdAt.toLocaleDateString("it-IT")}: puoi rispondere di nuovo quando vuoi.` : ""}
      </p>
      <ActionForm action={savePilotFeedbackAction} success="Grazie! Ci è arrivato" style={{ display: "grid", gap: 12 }}>
        <Question title="Cosa ti è servito di più?" hint="Scegli quelle che usi davvero.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PARTS.map((part) => (
              <label key={part} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "1px solid #ddd6fe", fontSize: 14 }}>
                <input type="checkbox" name="mostUsed" value={part} />
                {part}
              </label>
            ))}
          </div>
        </Question>
        <Question title="I punti di forza" hint="Cosa ti ha fatto risparmiare tempo o soldi, cosa ti è piaciuto.">
          <textarea name="strengths" style={area} />
        </Question>
        <Question title="Cosa non va" hint="Cosa ti ha dato fastidio, cosa non hai capito, dove ti sei bloccato.">
          <textarea name="problems" style={area} />
        </Question>
        <Question title="Cosa manca" hint="Una cosa che vorresti fare con Workbit e oggi non puoi.">
          <textarea name="missing" style={area} />
        </Question>
        <Question title="Quanto pagheresti al mese?" hint="Per come lo usi tu, IVA esclusa. Sii sincero: ci serve per decidere i prezzi.">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
            <input name="wouldPay" inputMode="numeric" placeholder="es. 40" style={{ ...field, width: 120 }} />€ al mese
          </label>
          <textarea name="payNote" placeholder="Facoltativo: perché, o a quali condizioni pagheresti di più" style={{ ...area, minHeight: 64 }} />
        </Question>
        <Question title="Quanto ti sembrerebbe caro?" hint="La cifra al mese oltre la quale diresti «è troppo, non lo prendo».">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
            <input name="tooExpensive" inputMode="numeric" placeholder="es. 90" style={{ ...field, width: 120 }} />€ al mese
          </label>
        </Question>
        <Question title="Quanto ti sembrerebbe troppo poco?" hint="La cifra al mese sotto la quale penseresti «costa così poco che non mi fido».">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
            <input name="tooCheap" inputMode="numeric" placeholder="es. 15" style={{ ...field, width: 120 }} />€ al mese
          </label>
        </Question>
        <Question title="Lo consiglieresti a un collega?" hint="0 = per niente, 10 = sicuramente.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(11, minmax(0, 1fr))", gap: 4 }}>
            {Array.from({ length: 11 }, (_, value) => (
              <label key={value} style={{ display: "grid", justifyItems: "center", gap: 2, fontSize: 13 }}>
                <input type="radio" name="recommend" value={value} />
                {value}
              </label>
            ))}
          </div>
        </Question>
        <PendingButton
          type="submit"
          pendingLabel="Invio…"
          style={{ minHeight: 52, borderRadius: 999, border: 0, background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}
        >
          Manda le risposte
        </PendingButton>
      </ActionForm>
    </div>
  );
}
