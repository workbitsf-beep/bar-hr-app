"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityType } from "@prisma/client";
import { isNativeApp } from "@/lib/native-app";
import { EmptyState, Panel, PrimaryButton, Stack } from "../ui";
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

const ALL = "__ALL__";

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1, 12)
  );
}

function monthName(month: number) {
  return new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date(2026, month - 1, 1, 12));
}

function shiftMonth(month: number, year: number, delta: number) {
  const moved = new Date(year, month - 1 + delta, 1, 12);

  return { month: moved.getMonth() + 1, year: moved.getFullYear() };
}

function Figure({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
  return (
    <span
      style={{
        display: "grid",
        gap: 1,
        padding: "11px 12px",
        borderRadius: 15,
        background: lead ? "#f3e8ff" : "#f8fafc",
        border: `1px solid ${lead ? "rgba(124, 58, 237, 0.42)" : "#e9edf3"}`,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 820,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: lead ? "#8b5cf6" : "#94a3b8",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 830,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: lead ? "#4c1d95" : "#0f172a",
        }}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * One card: what you are looking at is what the button downloads.
 *
 * The preview used to open as a second panel underneath the form, so while you
 * read it you could no longer see what you had chosen, and changing month
 * meant scrolling back up. There is nothing to open now - the month's figures
 * are simply on screen, and they follow the arrows.
 */
export function ExportClient({
  employees,
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
  const [userId, setUserId] = useState(allowGeneralReport ? ALL : employees[0]?.id ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ExportPayload | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/export/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, month, year, format: "json" }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ExportPayload
        | { ok?: false; message?: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        setResult(null);
        setMessage((payload as { message?: string } | null)?.message || "Report non disponibile");
        return;
      }

      setResult(payload);
    } catch {
      setResult(null);
      setMessage("Impossibile leggere le ore in questo momento.");
    } finally {
      setLoading(false);
    }
  }, [month, userId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadPdf() {
    setDownloading(true);
    setMessage("");

    try {
      // A web view cannot save a file handed to it in memory, so inside the
      // app the report is asked for as an address and collected by the phone's
      // browser. In a browser the direct download is still the better one.
      const asLink = isNativeApp();

      const response = await fetch("/api/export/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          month,
          year,
          format: "pdf",
          deliver: asLink ? "link" : "file",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(payload?.message || "PDF non disponibile");
        return;
      }

      if (asLink) {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; url?: string }
          | null;

        if (!payload?.ok || !payload.url) {
          setMessage("Impossibile preparare il PDF in questo momento.");
          return;
        }

        const { Browser } = await import("@capacitor/browser");

        await Browser.open({ url: new URL(payload.url, window.location.origin).toString() });
        return;
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `report-${year}-${month}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch {
      setMessage("Impossibile scaricare il PDF in questo momento.");
    } finally {
      setDownloading(false);
    }
  }

  const whoLabel =
    userId === ALL ? "Tutto il team" : employees.find((one) => one.id === userId)?.label ?? "";

  // A result of nothing should say whose nothing it is. "Nessuna timbratura nel
  // periodo selezionato" left people wondering if they had picked the wrong
  // month.
  // Someone reading their own report is not a third person: "Mario Rossi non
  // ha timbrature" is a strange thing to be told about yourself.
  const emptyMessage = !allowEmployeeSelection
    ? `Non hai timbrature a ${monthName(month)}.`
    : result?.mode === "company"
      ? `Nessuna registrazione per ${whoLabel} a ${monthName(month)}.`
      : `${whoLabel} non ha timbrature a ${monthName(month)}.`;

  return (
    <Stack className="workbit-export-page">
      <Panel
        title={allowEmployeeSelection ? "Report" : "Le tue ore"}
        className="workbit-export-generator"
      >
        {employees.length === 0 ? (
          <EmptyState message="Nessuna persona disponibile per l'export." />
        ) : (
          <div style={{ display: "grid", gap: 13 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "34px minmax(0, 1fr) 34px",
                alignItems: "center",
                gap: 8,
                padding: 5,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e9edf3",
              }}
            >
              <button
                type="button"
                aria-label="Mese precedente"
                onClick={() => {
                  const moved = shiftMonth(month, year, -1);
                  setMonth(moved.month);
                  setYear(moved.year);
                }}
                style={arrowStyle}
              >
                &lsaquo;
              </button>
              <span
                style={{
                  textAlign: "center",
                  fontWeight: 820,
                  fontSize: 14.5,
                  letterSpacing: "-0.02em",
                  color: "#0f172a",
                  textTransform: "capitalize",
                }}
              >
                {monthLabel(month, year)}
              </span>
              <button
                type="button"
                aria-label="Mese successivo"
                onClick={() => {
                  const moved = shiftMonth(month, year, 1);
                  setMonth(moved.month);
                  setYear(moved.year);
                }}
                style={arrowStyle}
              >
                &rsaquo;
              </button>
            </div>

            {allowEmployeeSelection ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allowGeneralReport ? (
                  <ChoiceChip
                    label="Tutto il team"
                    active={userId === ALL}
                    onClick={() => setUserId(ALL)}
                  />
                ) : null}
                {employees.map((employee) => (
                  <ChoiceChip
                    key={employee.id}
                    label={employee.label.split(" ")[0]}
                    active={userId === employee.id}
                    onClick={() => setUserId(employee.id)}
                  />
                ))}
              </div>
            ) : null}

            {result?.mode === "company" ? (
              <div
                className="dashboard-inline-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}
              >
                <Figure label="Ferie" value={String(result.summary?.vacation ?? 0)} lead />
                <Figure label="Permessi" value={String(result.summary?.permission ?? 0)} />
                <Figure label="Malattia" value={String(result.summary?.sickness ?? 0)} />
                <Figure label="Straordinari" value={String(result.summary?.overtime ?? 0)} />
                <Figure label="Corsi" value={String(result.summary?.courses ?? 0)} />
                <Figure label="Chiusure" value={String(result.summary?.closures ?? 0)} />
              </div>
            ) : (
              <div
                className="dashboard-inline-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}
              >
                <Figure
                  label="Reali"
                  value={formatDurationClock(result?.totals.realHours ?? 0)}
                  lead
                />
                <Figure
                  label="Arrotond."
                  value={formatDurationClock(result?.totals.roundedHours ?? 0)}
                />
                <Figure label="Giornate" value={String(result?.data.length ?? 0)} />
              </div>
            )}

            {message ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {message}
              </div>
            ) : null}

            {loading ? (
              <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 750 }}>Leggo le ore…</span>
            ) : result && result.data.length === 0 ? (
              <EmptyState message={emptyMessage} />
            ) : result ? (
              <div style={{ display: "grid", gap: 7 }}>
                {result.data.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: 11,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid #e9edf3",
                      background: "#ffffff",
                    }}
                  >
                    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{day.date}</strong>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: "#64748b",
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {result.mode === "company"
                          ? `${day.items?.length ?? 0} registrazioni`
                          : day.entries
                              .map(
                                (entry) =>
                                  `${new Date(entry.clockIn).toLocaleTimeString("it-IT", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: APP_TIME_ZONE,
                                  })}–${new Date(entry.clockOut).toLocaleTimeString("it-IT", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: APP_TIME_ZONE,
                                  })}`
                              )
                              .join(" · ") || "Nessuna timbratura"}
                      </span>
                    </span>

                    {result.mode === "company" ? null : (
                      <strong
                        style={{
                          fontSize: 14,
                          fontWeight: 830,
                          fontVariantNumeric: "tabular-nums",
                          color: "#4c1d95",
                        }}
                      >
                        {formatDurationClock(day.totals.realHours)}
                      </strong>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <PrimaryButton type="button" onClick={downloadPdf} disabled={downloading || !userId}>
              {downloading
                ? "Preparo il PDF..."
                : allowEmployeeSelection
                  ? `Scarica il PDF di ${monthName(month)}`
                  : `Scarica le tue ore di ${monthName(month)}`}
            </PrimaryButton>
          </div>
        )}
      </Panel>
    </Stack>
  );
}

const arrowStyle = {
  display: "inline-grid",
  placeItems: "center",
  height: 30,
  borderRadius: 10,
  background: "#ffffff",
  border: "1px solid #e9edf3",
  color: "#64748b",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
} as const;

function ChoiceChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 13px",
        borderRadius: 999,
        border: active ? "1px solid rgba(124, 58, 237, 0.46)" : "1px solid #e2e8f0",
        background: active ? "#f3e8ff" : "#ffffff",
        color: active ? "#4c1d95" : "#475569",
        fontSize: 12.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
