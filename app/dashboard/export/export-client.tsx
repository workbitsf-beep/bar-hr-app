"use client";

import { useState } from "react";
import {
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  TextInput,
} from "../ui";

type EmployeeOption = {
  id: string;
  label: string;
  email: string;
};

type ExportEntry = {
  inLogId: string;
  outLogId: string;
  clockIn: string;
  clockOut: string;
  realHours: number;
  roundedHours: number;
};

type GroupedDay = {
  date: string;
  entries: ExportEntry[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
  labels: string[];
};

type ExportPayload = {
  ok: true;
  data: GroupedDay[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
};

export function ExportClient({
  employees,
  defaultMonth,
  defaultYear,
  allowEmployeeSelection,
}: {
  employees: EmployeeOption[];
  defaultMonth: number;
  defaultYear: number;
  allowEmployeeSelection: boolean;
}) {
  const [userId, setUserId] = useState(employees[0]?.id ?? "");
  const [month, setMonth] = useState(String(defaultMonth));
  const [year, setYear] = useState(String(defaultYear));
  const [loading, setLoading] = useState<"preview" | "pdf" | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ExportPayload | null>(null);

  async function previewExport() {
    setLoading("preview");
    setMessage("");

    try {
      const response = await fetch("/api/export/monthly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          month: Number(month),
          year: Number(year),
          format: "json",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ExportPayload
        | { ok?: false; message?: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        setMessage((payload as { message?: string } | null)?.message || "Anteprima non disponibile");
        return;
      }

      setResult(payload);
    } catch {
      setMessage("Impossibile generare l'anteprima in questo momento.");
    } finally {
      setLoading(null);
    }
  }

  async function downloadPdf() {
    setLoading("pdf");
    setMessage("");

    try {
      const response = await fetch("/api/export/monthly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          month: Number(month),
          year: Number(year),
          format: "pdf",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setMessage(payload?.message || "PDF non disponibile");
        return;
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `report-${year}-${month}.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      setMessage("Impossibile scaricare il PDF in questo momento.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Stack>
      <Panel title="Genera report">
        {employees.length === 0 ? (
          <EmptyState message="Nessun dipendente disponibile per l'export." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Dipendente">
                <Select
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  disabled={!allowEmployeeSelection}
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Mese">
                <TextInput
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </FormField>

              <FormField label="Anno">
                <TextInput
                  type="number"
                  min={2000}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </FormField>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton
                type="button"
                onClick={previewExport}
                disabled={loading !== null || !userId}
              >
                {loading === "preview" ? "Caricamento..." : "Anteprima"}
              </PrimaryButton>
              <PrimaryButton
                type="button"
                tone="sand"
                onClick={downloadPdf}
                disabled={loading !== null || !userId}
              >
                {loading === "pdf" ? "Generazione..." : "Scarica PDF"}
              </PrimaryButton>
            </div>

            {message ? (
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>{message}</p>
            ) : null}
          </div>
        )}
      </Panel>

      <Panel title="Anteprima giornaliera">
        {!result ? (
          <EmptyState message="Genera un'anteprima per vedere ore reali, ore arrotondate e ferie o permessi." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ItemCard title="Ore reali" meta={`${result.totals.realHours.toFixed(2)} h`} />
              <ItemCard
                title="Ore arrotondate"
                meta={`${result.totals.roundedHours.toFixed(2)} h`}
              />
            </div>

            {result.data.length === 0 ? (
              <EmptyState message="Nessuna timbratura nel periodo selezionato." />
            ) : (
              <ItemList>
                {result.data.map((day) => (
                  <ItemCard
                    key={day.date}
                    title={day.date}
                    subtitle={`Ore reali ${day.totals.realHours.toFixed(2)} · Ore arrotondate ${day.totals.roundedHours.toFixed(2)}`}
                    meta={day.labels.length > 0 ? `Etichette: ${day.labels.join(", ")}` : "Nessuna etichetta"}
                    footer={
                      <div style={{ display: "grid", gap: 8 }}>
                        {day.entries.length === 0 ? (
                          <div style={{ color: "#64748b", fontSize: 14 }}>
                            Nessuna timbratura per questa giornata.
                          </div>
                        ) : (
                          day.entries.map((entry) => (
                            <div
                              key={`${entry.inLogId}-${entry.outLogId}`}
                              style={{ color: "#334155", fontSize: 14 }}
                            >
                              {new Date(entry.clockIn).toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              -{" "}
                              {new Date(entry.clockOut).toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              · reali {entry.realHours.toFixed(2)} h · arrotondate{" "}
                              {entry.roundedHours.toFixed(2)} h
                            </div>
                          ))
                        )}
                      </div>
                    }
                  />
                ))}
              </ItemList>
            )}
          </div>
        )}
      </Panel>
    </Stack>
  );
}
