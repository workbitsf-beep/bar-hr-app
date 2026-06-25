"use client";

import { useState } from "react";
import { ActivityType } from "@prisma/client";
import {
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
} from "../ui";
import { formatDurationClock } from "@/lib/time-format";
import { APP_TIME_ZONE } from "@/lib/time-zone";

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

type CompanyReportItem = {
  id: string;
  type: "Indisponibilita" | "Ferie" | "Permesso" | "Malattia" | "Straordinario" | "Corso" | "Chiusura";
  title: string;
  startsAt: string;
  endsAt: string;
  note?: string | null;
};

type GroupedDay = {
  date: string;
  entries: ExportEntry[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
  labels: string[];
  items?: CompanyReportItem[];
};

type ExportPayload = {
  ok: true;
  mode: "restaurant" | "company";
  data: GroupedDay[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
  summary?: {
    availability: number;
    vacation: number;
    permission: number;
    sickness: number;
    overtime: number;
    courses: number;
    closures: number;
    total: number;
  };
};

export function ExportClient({
  employees,
  activityType,
  defaultMonth,
  defaultYear,
  allowEmployeeSelection,
  allowGeneralReport,
}: {
  employees: EmployeeOption[];
  activityType: ActivityType | null;
  defaultMonth: number;
  defaultYear: number;
  allowEmployeeSelection: boolean;
  allowGeneralReport?: boolean;
}) {
  const [userId, setUserId] = useState(allowGeneralReport ? "__ALL__" : employees[0]?.id ?? "");
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

  const initialPreviewMessage =
    activityType === ActivityType.COMPANY
      ? "Genera un'anteprima per vedere indisponibilita, ferie, permessi e corsi registrati nel mese."
      : "Genera un'anteprima per vedere ore reali, ore lavorate e ferie o permessi.";
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const value = String(index + 1);
    const label = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(
      new Date(2026, index, 1)
    );

    return { value, label };
  });
  const yearOptions = Array.from({ length: 21 }, (_, index) => {
    const value = String(defaultYear - 10 + index);
    return { value, label: value };
  });

  return (
    <Stack>
      <Panel title="Genera report">
        {employees.length === 0 ? (
          <EmptyState message="Nessuna persona disponibile per l'export." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Profilo">
                <Select
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  disabled={!allowEmployeeSelection}
                >
                  {allowGeneralReport ? <option value="__ALL__">Report generale</option> : null}
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Mese">
                <Select
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Anno">
                <Select
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                >
                  {yearOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
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

      <Panel title="Anteprima mensile">
        {!result ? (
          <EmptyState message={initialPreviewMessage} />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {result.mode === "company" ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ItemCard title="Indisponibilita" meta={String(result.summary?.availability ?? 0)} />
                <ItemCard title="Ferie" meta={String(result.summary?.vacation ?? 0)} />
                <ItemCard title="Permessi" meta={String(result.summary?.permission ?? 0)} />
                <ItemCard title="Straordinari" meta={String(result.summary?.overtime ?? 0)} />
                <ItemCard title="Corsi" meta={String(result.summary?.courses ?? 0)} />
                <ItemCard title="Chiusure" meta={String(result.summary?.closures ?? 0)} />
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ItemCard title="Ore reali" meta={formatDurationClock(result.totals.realHours)} />
                <ItemCard
                  title="Ore lavorate"
                  meta={formatDurationClock(result.totals.roundedHours)}
                />
              </div>
            )}

            {result.data.length === 0 ? (
              <EmptyState
                message={
                  result.mode === "company"
                    ? "Nessuna registrazione nel periodo selezionato."
                    : "Nessuna timbratura nel periodo selezionato."
                }
              />
            ) : (
              <ItemList>
                {result.data.map((day) => (
                  <ItemCard
                    key={day.date}
                    title={day.date}
                    subtitle={
                      result.mode === "company"
                        ? `${day.items?.length ?? 0} registrazioni`
                        : `Ore reali ${formatDurationClock(day.totals.realHours)} - Ore lavorate ${formatDurationClock(day.totals.roundedHours)}`
                    }
                    meta={
                      result.mode === "company"
                        ? undefined
                        : day.labels.length > 0
                          ? `Etichette: ${day.labels.join(", ")}`
                          : "Nessuna etichetta"
                    }
                    footer={
                      result.mode === "company" ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {(day.items ?? []).map((item) => (
                            <div
                              key={item.id}
                              style={{ color: "#334155", fontSize: 14, display: "grid", gap: 4 }}
                            >
                              <strong style={{ color: "#0f172a" }}>
                                {item.type}: {item.title}
                              </strong>
                              <span>
                                {new Date(item.startsAt).toLocaleString("it-IT", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: APP_TIME_ZONE,
                                })}{" "}
                                -{" "}
                                {new Date(item.endsAt).toLocaleString("it-IT", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: APP_TIME_ZONE,
                                })}
                              </span>
                              {item.note ? <span style={{ color: "#64748b" }}>{item.note}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
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
                                timeZone: APP_TIME_ZONE,
                              })}{" "}
                              -{" "}
                                {new Date(entry.clockOut).toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: APP_TIME_ZONE,
                              })}{" "}
                                - reali {formatDurationClock(entry.realHours)} - lavorate{" "}
                                {formatDurationClock(entry.roundedHours)}
                              </div>
                            ))
                          )}
                        </div>
                      )
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
