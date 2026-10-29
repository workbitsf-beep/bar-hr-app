"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { showAppToast } from "@/app/components/app-toast";
import {
  cellText,
  DEFAULT_MESSAGE,
  LAYOUT_LABELS,
  PAYROLL_KINDS,
  renderPayrollTable,
  TEMPLATE_PRESETS,
  templateOf,
  type PayrollMonthData,
  type PayrollTemplate,
} from "@/lib/payroll/template";
import { saveRecipientAction } from "./actions";
import { TemplateEditor } from "./template-editor";

const quiet: CSSProperties = { color: "#8a85a3" };
const field: CSSProperties = {
  minHeight: 54,
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid #ece9f6",
  padding: "0 16px",
  fontSize: 17,
  color: "#1f1b3a",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};
const primary: CSSProperties = {
  width: "100%",
  minHeight: 54,
  borderRadius: 999,
  border: 0,
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 700,
  boxShadow: "0 12px 24px rgba(124,58,237,.22)",
  cursor: "pointer",
};
const sheet: CSSProperties = { background: "#ffffff", borderRadius: 22, overflow: "hidden" };
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function Progress({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }} aria-label={`Passo ${step} di 3`}>
      {[1, 2, 3].map((index) => (
        <span key={index} style={{ flex: 1, height: 4, borderRadius: 2, background: index <= step ? "#5e4ae3" : "#e4e1ef" }} />
      ))}
    </div>
  );
}

/**
 * Adding the consultant, one question per screen: who they are, what their
 * file looks like (theirs read for us, or a model), and the file itself with
 * this venue's real month before saving. Everything else has a default.
 */
export function ConsultantWizard({ sample, aiEnabled }: { sample: PayrollMonthData; aiEnabled: boolean }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"consulente" | "commercialista">("consulente");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [template, setTemplate] = useState<PayrollTemplate>(TEMPLATE_PRESETS[0].template);
  const [notes, setNotes] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [custom, setCustom] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const table = useMemo(() => renderPayrollTable(sample, template), [sample, template]);
  const ready = name.trim().length > 1 && EMAIL.test(email.trim());

  async function readSample(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/payroll/template-sample", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; template?: unknown; notes?: string[] } | null;
      if (!response.ok || !payload?.ok) {
        showAppToast(payload?.message ?? "File non letto: scegli un modello.", "error");
        return;
      }
      setTemplate(templateOf(payload.template));
      setNotes(payload.notes ?? []);
      setStep(3);
    } catch {
      showAppToast("File non letto: controlla la connessione.", "error");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const top = (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {step === 1 ? (
          <Link href="/dashboard/presenze/impostazioni" style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none" }}>
            Annulla
          </Link>
        ) : (
          <button type="button" onClick={() => setStep(step - 1)} style={{ border: 0, background: "transparent", padding: 0, fontSize: 15, fontWeight: 600, color: "#5e4ae3", cursor: "pointer" }}>
            ‹ Indietro
          </button>
        )}
        <span style={{ ...quiet, fontSize: 13.5 }}>{step} di 3</span>
      </div>
      <Progress step={step} />
    </div>
  );

  if (step === 1) {
    return (
      <div style={{ display: "grid", gap: 22 }}>
        {top}
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 750, letterSpacing: "-0.03em" }}>A chi mandi le presenze?</h1>
          <span style={{ ...quiet, fontSize: 15 }}>Ogni mese gli arriva il file dalla tua mail.</span>
        </div>
        <div role="radiogroup" aria-label="Chi è" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", background: "#ecebf4", borderRadius: 999, padding: 4 }}>
          {(
            [
              ["consulente", "Consulente"],
              ["commercialista", "Commercialista"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={role === key}
              onClick={() => setRole(key)}
              style={{
                minHeight: 40,
                borderRadius: 999,
                border: 0,
                background: role === key ? "#ffffff" : "transparent",
                color: role === key ? "#1f1b3a" : "#6f6a88",
                fontSize: 14.5,
                fontWeight: role === key ? 700 : 600,
                boxShadow: role === key ? "0 2px 6px rgba(31,27,58,.08)" : "none",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label style={{ display: "grid", gap: 8, fontSize: 13, color: "#8a85a3" }}>
          Nome o studio
          <input value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="Studio Rossi" autoComplete="organization" style={field} />
        </label>
        <label style={{ display: "grid", gap: 8, fontSize: 13, color: "#8a85a3" }}>
          Email
          <input value={email} onChange={(event) => setEmail(event.currentTarget.value)} placeholder="paghe@studiorossi.it" type="email" inputMode="email" autoComplete="email" style={field} />
        </label>
        <button type="button" disabled={!ready} onClick={() => setStep(2)} style={{ ...primary, opacity: ready ? 1 : 0.5 }}>
          Avanti
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        {top}
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 750, letterSpacing: "-0.03em" }}>Com&apos;è il suo file?</h1>
          <span style={{ ...quiet, fontSize: 15 }}>Workbit lo rifà uguale ogni mese.</span>
        </div>
        <input ref={fileInput} type="file" accept=".xlsx,.xlsm,.csv,.txt" style={{ display: "none" }} onChange={(event) => void readSample(event.currentTarget.files?.[0])} />
        <button
          type="button"
          disabled={!aiEnabled || reading}
          onClick={() => fileInput.current?.click()}
          style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            padding: 18,
            borderRadius: 22,
            background: aiEnabled ? "#faf9ff" : "#ffffff",
            border: aiEnabled ? "1.5px solid #6d5ce7" : "1.5px solid #ece9f6",
            color: "#1f1b3a",
            textAlign: "left",
            cursor: aiEnabled ? "pointer" : "default",
            opacity: aiEnabled ? 1 : 0.6,
            font: "inherit",
          }}
        >
          <span style={{ width: 44, height: 44, borderRadius: 14, background: "#efecff", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5e4ae3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
            </svg>
          </span>
          <span style={{ display: "grid", gap: 3 }}>
            <span style={{ fontSize: 17, fontWeight: 650 }}>{reading ? "Leggo il file…" : "Carica un suo file"}</span>
            <span style={{ ...quiet, fontSize: 14 }}>
              {aiEnabled ? "L'Excel o il CSV di un mese passato: colonne, causali e date le leggiamo noi." : "Non ancora attivo: per ora scegli un modello qui sotto."}
            </span>
          </span>
        </button>
        <span style={{ ...quiet, fontSize: 13, textAlign: "center" }}>oppure scegli un modello</span>
        <div style={sheet}>
          {TEMPLATE_PRESETS.map((preset, index) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                setTemplate(preset.template);
                setNotes([]);
                setStep(3);
              }}
              style={{
                all: "unset",
                boxSizing: "border-box",
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "15px 18px",
                borderTop: index ? "1px solid #f2f0f8" : 0,
                cursor: "pointer",
                color: "#1f1b3a",
              }}
            >
              <span style={{ flex: 1, fontSize: 15.5 }}>{preset.title.replace(/ \((Excel|CSV)\)$/, "")}</span>
              <span style={{ ...quiet, fontSize: 13 }}>{preset.template.fileType === "csv" ? "CSV" : "Excel"}</span>
              <span style={{ color: "#c4c0d6" }}>›</span>
            </button>
          ))}
        </div>
        <span style={{ ...quiet, fontSize: 13, textAlign: "center" }}>Non sai quale? Chiedi al consulente il file di un mese qualsiasi.</span>
      </div>
    );
  }

  const codes = PAYROLL_KINDS.filter((kind) => template.codes[kind])
    .slice(0, 4)
    .map((kind) => template.codes[kind])
    .join(" · ");

  return (
    <ActionForm action={saveRecipientAction} style={{ display: "grid", gap: 18 }}>
      {top}
      <input type="hidden" name="id" value="" />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="name" value={name.trim()} />
      <input type="hidden" name="email" value={email.trim()} />
      <input type="hidden" name="cc" value="" />
      <input type="hidden" name="sendDay" value="2" />
      <input type="hidden" name="message" value={DEFAULT_MESSAGE} />
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 750, letterSpacing: "-0.03em" }}>Ecco il suo file</h1>
        <span style={{ ...quiet, fontSize: 15 }}>Con le presenze vere del mese.</span>
      </div>
      {notes.length ? (
        <ul style={{ margin: 0, padding: "12px 16px 12px 32px", background: "#faf9ff", borderRadius: 16, fontSize: 13.5, color: "#4b4763", display: "grid", gap: 4 }}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {custom ? (
        <div style={sheet}>
          <TemplateEditor initial={template} sample={sample} aiEnabled={false} />
        </div>
      ) : (
        <>
          <input type="hidden" name="template" value={JSON.stringify(template)} />
          <div style={sheet}>
            {[
              ["Forma", LAYOUT_LABELS[template.layout].title],
              ["File", template.fileType === "csv" ? "CSV" : "Excel"],
              ["Causali", codes || "–"],
            ].map(([label, text], index) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderTop: index ? "1px solid #f2f0f8" : 0, fontSize: 15 }}>
                <span style={quiet}>{label}</span>
                <span style={{ textAlign: "right" }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ ...sheet, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
              {table.header ? (
                <thead>
                  <tr>
                    {table.header.slice(0, 6).map((cell, index) => (
                      <th key={index} style={{ padding: "9px 10px", textAlign: "left", background: "#faf9ff", color: "#6f6a88", fontWeight: 650, whiteSpace: "nowrap" }}>
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {table.rows.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.slice(0, 6).map((cell, index) => (
                      <td key={index} style={{ padding: "8px 10px", borderTop: "1px solid #f2f0f8", whiteSpace: "nowrap" }}>
                        {cellText(cell, template)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!table.rows.length ? (
                  <tr>
                    <td style={{ padding: "10px", color: "#8a85a3" }}>Nel mese non ci sono ancora ore: il file avrà questa forma.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setCustom((value) => !value)}
        style={{ border: 0, background: "transparent", color: "#5e4ae3", fontSize: 14.5, fontWeight: 600, cursor: "pointer", justifySelf: "center", minHeight: 40 }}
      >
        {custom ? "Chiudi la personalizzazione" : "Personalizza colonne e formati"}
      </button>

      <PendingButton type="submit" pendingLabel="Salvo…" style={primary}>
        Salva
      </PendingButton>
      <span style={{ ...quiet, fontSize: 12.5, textAlign: "center" }}>Il 2 di ogni mese ti ricordiamo di mandarlo. Si cambia dalle impostazioni.</span>
    </ActionForm>
  );
}
