"use client";

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ActionForm } from "@/app/components/action-form";
import { showAppToast } from "@/app/components/app-toast";
import { PendingButton } from "@/app/components/pending-button";
import { isActionFailure } from "@/lib/rule-error";
import { cellText, LAYOUT_LABELS, payrollFileBaseName, renderPayrollTable, TEMPLATE_PRESETS, templateOf, type PayrollMonthData, type PayrollTemplate } from "@/lib/payroll/template";
import { PopupAction } from "../popup-action";
import { saveRecipientFieldAction } from "./actions";
import { TemplateFields } from "./template-editor";

const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", borderTop: "1px solid #f2f0f8", color: "#1f1b3a", fontSize: 16, width: "100%", boxSizing: "border-box" };
const chevron = <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18, marginLeft: "auto" }}>›</span>;
const sheet: CSSProperties = { background: "#ffffff", borderRadius: 22, overflow: "hidden", boxShadow: "0 1px 2px rgba(31,27,58,.04)" };

function Line({ children, first = false, note }: { children: ReactNode; first?: boolean; note?: string }) {
  return (
    <span style={{ ...row, borderTop: first ? 0 : row.borderTop }}>
      <span>{children}</span>
      {note ? <span style={{ marginLeft: "auto", color: "#8a85a3", fontSize: 14.5 }}>{note}</span> : null}
      {chevron}
    </span>
  );
}

/**
 * The consultant's file on its own page: how it comes out first, then the
 * three ways to change it. Nothing is saved until Salva, which shows up as
 * soon as the file differs from the one the consultant gets now.
 */
export function RecipientFile({ recipientId, initial, sample, aiEnabled }: { recipientId: string; initial: PayrollTemplate; sample: PayrollMonthData; aiEnabled: boolean }) {
  const [template, setTemplate] = useState<PayrollTemplate>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [notes, setNotes] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const table = useMemo(() => renderPayrollTable(sample, template), [sample, template]);
  const current = JSON.stringify(template);
  const dirty = current !== saved;

  async function readSample(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setNotes([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/payroll/template-sample", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; template?: unknown; notes?: string[] } | null;
      if (!response.ok || !payload?.ok) {
        showAppToast(payload?.message ?? "File non letto.", "error");
        return;
      }
      setTemplate(templateOf(payload.template));
      setNotes(payload.notes ?? []);
      showAppToast("File rifatto come il suo: guarda l'anteprima e salva");
    } catch {
      showAppToast("File non letto: controlla la connessione.", "error");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...sheet, padding: "10px 6px" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            {table.header ? (
              <thead>
                <tr>
                  {table.header.map((cell, index) => (
                    <th key={index} style={{ textAlign: "left", color: "#8a85a3", fontWeight: 500, padding: "6px 8px", borderBottom: "1px solid #eeebf7" }}>
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {table.rows.slice(0, 6).map((cells, rowIndex) => (
                <tr key={rowIndex}>
                  {cells.map((cell, index) => (
                    <td key={index} style={{ padding: "6px 8px", borderBottom: "1px solid #f4f3f9", textAlign: typeof cell === "number" ? "right" : "left" }}>
                      {cellText(cell, template)}
                    </td>
                  ))}
                </tr>
              ))}
              {!table.rows.length ? (
                <tr>
                  <td style={{ padding: "8px", color: "#8a85a3" }}>Nessuna riga: questo mese non ci sono ancora ore.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12.5, color: "#8a85a3", padding: "8px 8px 2px" }}>
          {payrollFileBaseName(sample, template)}.{template.fileType} · {LAYOUT_LABELS[template.layout].title.toLowerCase()}
          {table.rows.length > 6 ? ` · ${table.rows.length} righe` : ""}
        </div>
        {table.legend ? <div style={{ fontSize: 12, color: "#8a85a3", padding: "2px 8px" }}>{table.legend}</div> : null}
      </div>

      {notes.length ? (
        <ul style={{ margin: 0, padding: "0 18px 0 34px", fontSize: 13.5, color: "#5b5675", display: "grid", gap: 3 }}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div style={sheet}>
        {aiEnabled ? (
          <>
            <input ref={fileInput} type="file" accept=".xlsx,.xlsm,.csv,.txt" style={{ display: "none" }} onChange={(event) => void readSample(event.currentTarget.files?.[0])} />
            <button type="button" disabled={reading} onClick={() => fileInput.current?.click()} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent", textAlign: "left", font: "inherit", cursor: "pointer" }}>
              <Line first>{reading ? "📎 Leggo il file…" : "📎 Carica un suo file d'esempio"}</Line>
            </button>
          </>
        ) : null}
        <PopupAction title="Scegli un modello" ariaLabel="Scegli un altro modello" triggerRow={<Line first={!aiEnabled}>📋 Scegli un altro modello</Line>}>
          <div style={{ display: "grid", gap: 8 }}>
            {TEMPLATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                data-popup-close
                onClick={() => setTemplate({ ...preset.template, codes: template.codes })}
                style={{ display: "grid", gap: 2, textAlign: "left", padding: "12px 14px", borderRadius: 16, border: "1px solid #eeebf7", background: "#fbfaff", color: "#1f1b3a", cursor: "pointer", font: "inherit" }}
              >
                <span style={{ fontSize: 15.5, fontWeight: 600 }}>{preset.title}</span>
                <span style={{ fontSize: 13, color: "#8a85a3" }}>{preset.hint}</span>
              </button>
            ))}
          </div>
        </PopupAction>
        <PopupAction title="Le colonne" ariaLabel="Cambia le colonne" triggerRow={<Line note={`${template.columns.length} colonne`}>✏️ Cambia le colonne</Line>}>
          <div style={{ margin: "-14px -15px 0" }}>
            <TemplateFields template={template} setTemplate={setTemplate} />
          </div>
          <button type="button" data-popup-close style={{ minHeight: 48, borderRadius: 999, border: 0, background: "#eeebf7", color: "#3b1d8f", fontSize: 15, fontWeight: 650, cursor: "pointer" }}>
            Fatto
          </button>
        </PopupAction>
      </div>
      {aiEnabled ? <span style={{ fontSize: 13, color: "#8a85a3", padding: "0 18px", marginTop: -6 }}>Dal suo file d&apos;esempio Workbit rifà le colonne da solo.</span> : null}

      {dirty ? (
        <ActionForm
          action={async (formData) => {
            const result = await saveRecipientFieldAction(formData);
            if (!isActionFailure(result)) setSaved(current);
            return result;
          }}
          success="File salvato"
          style={{ position: "sticky", bottom: 12, display: "grid", gap: 8 }}>
          <input type="hidden" name="id" value={recipientId} />
          <input type="hidden" name="field" value="template" />
          <input type="hidden" name="template" value={current} />
          <PendingButton
            type="submit"
            pendingLabel="Salvo…"
            style={{ minHeight: 50, borderRadius: 999, border: 0, background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 22px rgba(124, 58, 237, 0.22)" }}
          >
            Salva il file
          </PendingButton>
          <button type="button" onClick={() => setTemplate(templateOf(JSON.parse(saved)))} style={{ border: 0, background: "transparent", color: "#8a85a3", fontSize: 14, cursor: "pointer", minHeight: 32 }}>
            Lascia com&apos;era
          </button>
        </ActionForm>
      ) : null}
    </div>
  );
}
