"use client";

import { useMemo, useRef, useState } from "react";
import { showAppToast } from "@/app/components/app-toast";
import {
  cellText,
  DATE_FORMATS,
  FIELD_LABELS,
  formatDate,
  LAYOUT_FIELDS,
  LAYOUT_LABELS,
  PAYROLL_CODE_LABELS,
  PAYROLL_KINDS,
  payrollFileBaseName,
  renderPayrollTable,
  TEMPLATE_PRESETS,
  templateOf,
  type PayrollCodeKey,
  type PayrollField,
  type PayrollLayout,
  type PayrollMonthData,
  type PayrollTemplate,
} from "@/lib/payroll/template";

const input = {
  minHeight: 38,
  borderRadius: 12,
  border: "1px solid #e9e6f5",
  padding: "0 10px",
  fontSize: 15,
  width: "100%",
  minWidth: 0,
  background: "#ffffff",
} as const;

const label = { display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" } as const;

const chip = (active: boolean) =>
  ({
    padding: "8px 12px",
    borderRadius: 14,
    border: active ? "1px solid #6d5ce7" : "1px solid #e9e6f5",
    background: active ? "#f6f3ff" : "#ffffff",
    color: "#1f1b3a",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: 2,
    fontSize: 14,
  }) as const;

const soft = {
  minHeight: 36,
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13.5,
  fontWeight: 740,
  cursor: "pointer",
  padding: "0 14px",
} as const;

const small = { border: 0, background: "transparent", color: "#7c7894", cursor: "pointer", fontSize: 16, padding: "0 4px", minHeight: 36 } as const;

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8, padding: "14px 15px", borderTop: "1px solid #f1eff8" }}>
      <span style={{ fontSize: 11.5, fontWeight: 760, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7c7894" }}>{title}</span>
      {hint ? <span style={{ fontSize: 12.5, color: "#7c7894", marginTop: -4 }}>{hint}</span> : null}
      {children}
    </div>
  );
}

/**
 * The file as the consultant wants it, built in front of the owner: a file
 * of theirs read by Claude, a starting layout, then every column, code and
 * format, with the file previewed from this venue's real month as it changes.
 * The template travels to the save action as JSON in a hidden field.
 */
export function TemplateEditor({ initial, sample, aiEnabled }: { initial: PayrollTemplate; sample: PayrollMonthData; aiEnabled: boolean }) {
  const [template, setTemplate] = useState<PayrollTemplate>(initial);
  const [notes, setNotes] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<PayrollTemplate>) => setTemplate((current) => templateOf({ ...current, ...patch }));

  const table = useMemo(() => renderPayrollTable(sample, template), [sample, template]);
  const fields = template.layout === "calendar" ? LAYOUT_FIELDS.perPerson : LAYOUT_FIELDS[template.layout];

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
      showAppToast("Formato ricavato dal file: controlla l'anteprima e salva");
    } catch {
      showAppToast("File non letto: controlla la connessione.", "error");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const moveColumn = (index: number, by: number) =>
    setTemplate((current) => {
      const columns = [...current.columns];
      const target = index + by;
      if (target < 0 || target >= columns.length) return current;
      [columns[index], columns[target]] = [columns[target], columns[index]];
      return { ...current, columns };
    });

  const moveKind = (kind: PayrollCodeKey, by: number) =>
    setTemplate((current) => {
      const kinds = [...current.personKinds];
      const index = kinds.indexOf(kind);
      const target = index + by;
      if (index < 0 || target < 0 || target >= kinds.length) return current;
      [kinds[index], kinds[target]] = [kinds[target], kinds[index]];
      return { ...current, personKinds: kinds };
    });

  return (
    <div style={{ display: "grid" }}>
      <input type="hidden" name="template" value={JSON.stringify(template)} />

      <Block
        title="Dal file del consulente"
        hint={
          aiEnabled
            ? "Carica un file che il consulente usa già (l'Excel o il CSV di un mese passato): Workbit lo legge e lo rifà uguale, colonne, nomi e causali."
            : "La lettura automatica del file non è ancora attiva: scegli un modello qui sotto e sistemalo."
        }
      >
        {aiEnabled ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xlsm,.csv,.txt"
              style={{ display: "none" }}
              onChange={(event) => void readSample(event.currentTarget.files?.[0])}
            />
            <div>
              <button type="button" style={soft} disabled={reading} onClick={() => fileInput.current?.click()}>
                {reading ? "Leggo il file…" : "Carica un file del consulente"}
              </button>
            </div>
            {notes.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#4b4763", display: "grid", gap: 3 }}>
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </Block>

      <Block title="Oppure parti da un modello">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
          {TEMPLATE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              style={chip(false)}
              onClick={() => setTemplate({ ...preset.template, codes: template.codes })}
            >
              <span style={{ fontWeight: 720 }}>{preset.title}</span>
              <span style={{ fontSize: 12.5, color: "#7c7894" }}>{preset.hint}</span>
            </button>
          ))}
        </div>
      </Block>

      <Block title="Forma del file">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
          {(Object.keys(LAYOUT_LABELS) as PayrollLayout[]).map((layout) => (
            <button
              key={layout}
              type="button"
              aria-pressed={template.layout === layout}
              style={chip(template.layout === layout)}
              onClick={() => {
                const allowed = layout === "calendar" ? LAYOUT_FIELDS.perPerson : LAYOUT_FIELDS[layout];
                set({ layout, columns: template.columns.filter((column) => allowed.includes(column.field)) });
              }}
            >
              <span style={{ fontWeight: 720 }}>{LAYOUT_LABELS[layout].title}</span>
              <span style={{ fontSize: 12.5, color: "#7c7894" }}>{LAYOUT_LABELS[layout].hint}</span>
            </button>
          ))}
        </div>
      </Block>

      <Block
        title={template.layout === "calendar" ? "Colonne prima dei giorni" : template.layout === "perPerson" ? "Colonne della persona" : "Colonne"}
        hint="Nell'ordine del file. L'intestazione la scrivi come la vuole il consulente."
      >
        {template.columns.map((column, index) => (
          <div key={index} style={{ display: "grid", gap: 6, padding: "10px 12px", border: "1px solid #f1eff8", borderRadius: 14, background: "#fbfaff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7c7894", textAlign: "center" }}>{index + 1}</span>
              <input
                value={column.header}
                aria-label="Intestazione della colonna"
                placeholder="Intestazione"
                onChange={(event) => {
                  const header = event.currentTarget.value;
                  setTemplate((current) => ({ ...current, columns: current.columns.map((item, position) => (position === index ? { ...item, header } : item)) }));
                }}
                style={{ ...input, fontWeight: 600 }}
              />
              <span style={{ display: "flex" }}>
                <button type="button" style={small} aria-label="Sposta su" onClick={() => moveColumn(index, -1)}>
                  ↑
                </button>
                <button type="button" style={small} aria-label="Sposta giù" onClick={() => moveColumn(index, 1)}>
                  ↓
                </button>
                <button type="button" style={small} aria-label="Togli" onClick={() => set({ columns: template.columns.filter((_, position) => position !== index) })}>
                  ×
                </button>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
              <span aria-hidden />
              <select
                value={column.field}
                aria-label="Cosa contiene"
                onChange={(event) => {
                  const field = event.currentTarget.value as PayrollField;
                  set({ columns: template.columns.map((item, position) => (position === index ? { field, header: FIELD_LABELS[field], ...(field === "fisso" ? { value: "" } : {}) } : item)) });
                }}
                style={{ ...input, minHeight: 34, fontSize: 13.5, color: "#4b4763" }}
              >
                {fields.map((item) => (
                  <option key={item} value={item}>
                    Contiene: {FIELD_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            {column.field === "fisso" ? (
              <div style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr)", gap: 8 }}>
                <span aria-hidden />
                <input
                  value={column.value ?? ""}
                  aria-label="Valore"
                  placeholder="Valore su ogni riga"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setTemplate((current) => ({ ...current, columns: current.columns.map((item, position) => (position === index ? { ...item, value } : item)) }));
                  }}
                  style={input}
                />
              </div>
            ) : null}
          </div>
        ))}
        <div>
          <select
            value=""
            aria-label="Aggiungi una colonna"
            onChange={(event) => {
              const field = event.currentTarget.value as PayrollField;
              if (field) set({ columns: [...template.columns, { field, header: FIELD_LABELS[field], ...(field === "fisso" ? { value: "" } : {}) }] });
            }}
            style={{ ...input, width: "auto", color: "#4c1d95", fontWeight: 700 }}
          >
            <option value="">+ Aggiungi una colonna</option>
            {fields.map((item) => (
              <option key={item} value={item}>
                {FIELD_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
      </Block>

      {template.layout === "perPerson" ? (
        <Block title="Colonne delle causali" hint="Dopo le colonne della persona, una per causale, in quest'ordine.">
          {template.personKinds.map((kind) => (
            <div key={kind} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
              <span>{PAYROLL_CODE_LABELS[kind]}</span>
              <span style={{ display: "flex" }}>
                <button type="button" style={small} aria-label="Sposta su" onClick={() => moveKind(kind, -1)}>
                  ↑
                </button>
                <button type="button" style={small} aria-label="Sposta giù" onClick={() => moveKind(kind, 1)}>
                  ↓
                </button>
                <button type="button" style={small} aria-label="Togli" onClick={() => set({ personKinds: template.personKinds.filter((item) => item !== kind) })}>
                  ×
                </button>
              </span>
            </div>
          ))}
          {PAYROLL_KINDS.filter((kind) => !template.personKinds.includes(kind)).length ? (
            <select
              value=""
              aria-label="Aggiungi una causale"
              onChange={(event) => {
                const kind = event.currentTarget.value as PayrollCodeKey;
                if (kind) set({ personKinds: [...template.personKinds, kind] });
              }}
              style={{ ...input, width: "auto" }}
            >
              <option value="">+ Aggiungi una causale</option>
              {PAYROLL_KINDS.filter((kind) => !template.personKinds.includes(kind)).map((kind) => (
                <option key={kind} value={kind}>
                  {PAYROLL_CODE_LABELS[kind]}
                </option>
              ))}
            </select>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            <label style={label}>
              Intestazioni
              <select value={template.personHeader} onChange={(event) => set({ personHeader: event.currentTarget.value as "code" | "label" })} style={input}>
                <option value="label">Il nome (Ferie, Malattia…)</option>
                <option value="code">Il codice (FER, MAL…)</option>
              </select>
            </label>
            <label style={label}>
              Ferie e malattia
              <select value={template.personDayUnit} onChange={(event) => set({ personDayUnit: event.currentTarget.value as "days" | "hours" })} style={input}>
                <option value="days">In giorni</option>
                <option value="hours">In ore</option>
              </select>
            </label>
          </div>
        </Block>
      ) : null}

      {template.layout === "calendar" ? (
        <Block title="Caselle dei giorni">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            <label style={label}>
              Nella casella
              <select value={template.calendarCell} onChange={(event) => set({ calendarCell: event.currentTarget.value as "hours" | "codeHours" })} style={input}>
                <option value="codeHours">Ore, e il codice per assenze e straordinari</option>
                <option value="hours">Solo le ore (codice per le assenze)</option>
              </select>
            </label>
            <label style={{ ...label, display: "flex", alignItems: "center", gap: 8, color: "#1f1b3a", fontSize: 14 }}>
              <input type="checkbox" checked={template.calendarTotals} onChange={(event) => set({ calendarTotals: event.currentTarget.checked })} />
              Colonna del totale ore
            </label>
          </div>
        </Block>
      ) : null}

      <Block title="Causali" hint="Il codice di ogni voce nel programma paghe del consulente. Lascia vuoto per non mandare quella voce.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {PAYROLL_KINDS.map((kind) => (
            <label key={kind} style={label}>
              {PAYROLL_CODE_LABELS[kind]}
              <input
                value={template.codes[kind]}
                maxLength={16}
                onChange={(event) => {
                  const code = event.currentTarget.value.toUpperCase();
                  setTemplate((current) => ({ ...current, codes: { ...current.codes, [kind]: code } }));
                }}
                style={{ ...input, textTransform: "uppercase" }}
              />
            </label>
          ))}
        </div>
      </Block>

      <Block title="File">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          <label style={label}>
            Tipo
            <select value={template.fileType} onChange={(event) => set({ fileType: event.currentTarget.value as "xlsx" | "csv" })} style={input}>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </label>
          {template.fileType === "csv" ? (
            <>
              <label style={label}>
                Separatore
                <select value={template.csvSeparator} onChange={(event) => set({ csvSeparator: event.currentTarget.value as PayrollTemplate["csvSeparator"] })} style={input}>
                  <option value=";">Punto e virgola ;</option>
                  <option value=",">Virgola ,</option>
                  <option value={"\t"}>Tabulazione</option>
                  <option value="|">Barra |</option>
                </select>
              </label>
              <label style={label}>
                Caratteri
                <select value={template.encoding} onChange={(event) => set({ encoding: event.currentTarget.value as PayrollTemplate["encoding"] })} style={input}>
                  <option value="utf8bom">UTF-8 per Excel</option>
                  <option value="utf8">UTF-8</option>
                  <option value="latin1">Windows (ANSI)</option>
                </select>
              </label>
            </>
          ) : (
            <label style={label}>
              Nome del foglio
              <input value={template.sheetName} maxLength={31} onChange={(event) => set({ sheetName: event.currentTarget.value })} style={input} />
            </label>
          )}
          <label style={label}>
            Date
            <select value={template.dateFormat} onChange={(event) => set({ dateFormat: event.currentTarget.value as PayrollTemplate["dateFormat"] })} style={input}>
              {DATE_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {formatDate("2026-10-05", format)}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>
            Ore
            <select
              value={`${template.hoursFormat}:${template.decimal}`}
              onChange={(event) => {
                const [hoursFormat, decimal] = event.currentTarget.value.split(":") as [PayrollTemplate["hoursFormat"], PayrollTemplate["decimal"]];
                set({ hoursFormat, decimal });
              }}
              style={input}
            >
              <option value="decimal:comma">7,5</option>
              <option value="decimal:dot">7.5</option>
              <option value="hhmm:comma">7:30</option>
            </select>
          </label>
        </div>
        <label style={label}>
          Nome del file
          <input value={template.fileName} maxLength={80} onChange={(event) => set({ fileName: event.currentTarget.value })} style={input} />
        </label>
        <span style={{ fontSize: 12, color: "#7c7894" }}>Nel nome: {"{azienda}"}, {"{anno}"}, {"{mese}"}, {"{nomemese}"}.</span>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={template.headerRow} onChange={(event) => set({ headerRow: event.currentTarget.checked })} />
            Prima riga con le intestazioni
          </label>
          {template.layout === "rows" || template.layout === "perCode" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={template.skipEmpty} onChange={(event) => set({ skipEmpty: event.currentTarget.checked })} />
              Salta le righe a zero
            </label>
          ) : null}
          {template.fileType === "xlsx" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={template.summarySheet} onChange={(event) => set({ summarySheet: event.currentTarget.checked })} />
              Aggiungi un foglio di riepilogo per persona
            </label>
          ) : null}
        </div>
      </Block>

      <Block title="Anteprima" hint={`${payrollFileBaseName(sample, template)}.${template.fileType} · con i dati veri del locale${table.rows.length > 12 ? `, prime 12 righe di ${table.rows.length}` : ""}`}>
        <div style={{ overflowX: "auto", border: "1px solid #e9e6f5", borderRadius: 12, background: "#ffffff" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "nowrap" }}>
            {table.header ? (
              <thead>
                <tr>
                  {table.header.map((cell, index) => (
                    <th key={index} style={{ padding: "6px 9px", background: "#f6f3ff", textAlign: "left", borderBottom: "1px solid #e9e6f5" }}>
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {table.rows.slice(0, 12).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index} style={{ padding: "5px 9px", borderTop: "1px solid #f1eff8", textAlign: typeof cell === "number" ? "right" : "left" }}>
                      {cellText(cell, template)}
                    </td>
                  ))}
                </tr>
              ))}
              {!table.rows.length ? (
                <tr>
                  <td style={{ padding: "8px 10px", color: "#7c7894" }}>Nessuna riga: nel mese di prova non ci sono ore.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {table.legend ? <span style={{ fontSize: 12, color: "#7c7894" }}>{table.legend}</span> : null}
      </Block>
    </div>
  );
}
