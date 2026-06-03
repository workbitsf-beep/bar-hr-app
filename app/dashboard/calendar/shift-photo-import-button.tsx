"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { matchShiftPhotoMember, type ShiftPhotoMember } from "@/lib/shift-photo-parser";
import { IconButton, PrimaryButton, Select, TextInput } from "../ui";
import { TimeInput } from "@/app/components/time-input";

export type ShiftPhotoImportRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  confidence: number;
  notes: string;
  matchStatus: "matched" | "unmatched";
};

type ImportedShiftFromApi = {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  confidence: number;
  notes: string;
  employeeId: string | null;
  matchStatus: "matched" | "unmatched";
};

function createEmptyRow(defaultDate = ""): ShiftPhotoImportRow {
  return {
    id: crypto.randomUUID(),
    employeeId: "",
    employeeName: "",
    date: defaultDate,
    startTime: "",
    endTime: "",
    confidence: 0,
    notes: "",
    matchStatus: "unmatched",
  };
}

function formatMemberLabel(member: ShiftPhotoMember) {
  const roleLabel =
    member.role === "OWNER" ? "Titolare" : member.role === "MANAGER" ? "Manager" : "Dipendente";

  return `${member.firstName} ${member.lastName} - ${roleLabel}`;
}

function formatConfidence(confidence: number) {
  const value = Math.max(0, Math.min(1, confidence));
  return `${Math.round(value * 100)}%`;
}

function isValidTimeValue(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function isValidDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildRowErrors(row: ShiftPhotoImportRow) {
  const errors: string[] = [];

  if (!row.employeeId) {
    errors.push("Seleziona il dipendente.");
  }

  if (!isValidDateValue(row.date)) {
    errors.push("Data non valida.");
  }

  if (!isValidTimeValue(row.startTime) || !isValidTimeValue(row.endTime)) {
    errors.push("Orari non validi.");
  }

  const start = new Date(`${row.date}T${row.startTime}`);
  const end = new Date(`${row.date}T${row.endTime}`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    errors.push("Controlla inizio e fine turno.");
  }

  return errors;
}

export function ShiftPhotoImportButton({
  members,
  rangeStart,
  rangeEnd,
  disabled,
  onImport,
}: {
  members: ShiftPhotoMember[];
  rangeStart: string;
  rangeEnd: string;
  disabled?: boolean;
  onImport: (drafts: ShiftPhotoImportRow[]) => Promise<number> | number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<ShiftPhotoImportRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateLayout = () => {
      setIsMobileLayout(window.innerWidth < 760);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);

    return () => {
      window.removeEventListener("resize", updateLayout);
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, isOpen]);

  function resetDrafts() {
    setRows([]);
    setError(null);
    setMessage(null);
  }

  function openPicker() {
    if (disabled || busy) {
      return;
    }

    setIsOpen(true);
    setSelectedFile(null);
    setRows([]);
    setError(null);
    setMessage(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || disabled || busy) {
      return;
    }

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

    if (!allowedTypes.has(file.type)) {
      setError("Formato non supportato. Usa PNG, JPG, WEBP o GIF.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("L'immagine supera il limite di 8MB.");
      return;
    }

    setIsOpen(true);
    setSelectedFile(file);
    setRows([]);
    setError(null);
    setMessage(null);
  }

  function handleClose() {
    if (busy) {
      return;
    }

    setIsOpen(false);
    setSelectedFile(null);
    resetDrafts();
  }

  function updateRow(rowId: string, patch: Partial<ShiftPhotoImportRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          ...patch,
        };
      })
    );
  }

  function addManualRow() {
    setRows((current) => [...current, createEmptyRow(rangeStart)]);
  }

  function removeRow(rowId: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== rowId)));
  }

  async function analyzePhoto() {
    if (disabled || busy) {
      return;
    }

    if (!selectedFile) {
      setError("Carica una foto prima di analizzare.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("Analisi in corso...");

    try {
      const formData = new FormData();
      formData.set("image", selectedFile);
      formData.set("rangeStart", rangeStart);
      formData.set("rangeEnd", rangeEnd);

      const response = await fetch("/api/shifts/import-from-image", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            shifts?: ImportedShiftFromApi[];
            message?: string;
          }
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "Impossibile analizzare la foto.");
      }

      const mapped = (result.shifts ?? []).map((shift) => {
        const matchedMember = shift.employeeId
          ? members.find((member) => member.id === shift.employeeId) ?? null
          : matchShiftPhotoMember(shift.employeeName, members);

        return {
          id: crypto.randomUUID(),
          employeeId: matchedMember?.id ?? "",
          employeeName: matchedMember
            ? `${matchedMember.firstName} ${matchedMember.lastName}`.trim()
            : shift.employeeName,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          confidence: Number(shift.confidence ?? 0),
          notes: shift.notes ?? "",
          matchStatus: matchedMember ? "matched" : "unmatched",
        } satisfies ShiftPhotoImportRow;
      });

      if (mapped.length === 0) {
        setRows([]);
        setMessage("Nessun turno leggibile nella foto.");
        return;
      }

      setRows(mapped);
      setMessage(`Trovati ${mapped.length} turni. Controlla i dati prima di confermare.`);
    } catch (analysisError) {
      const reason = analysisError instanceof Error ? analysisError.message : "Analisi non riuscita.";
      setError(reason);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmImport() {
    const invalidRows = rows
      .map((row, index) => ({ index, errors: buildRowErrors(row) }))
      .filter((row) => row.errors.length > 0);

    if (invalidRows.length > 0) {
      const firstError = invalidRows[0];
      setError(`Correggi la riga ${firstError.index + 1}: ${firstError.errors[0]}`);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage("Importazione in corso...");

    try {
      const importedCount = await onImport(rows);
      setMessage(
        importedCount === 1
          ? "1 turno importato dalla foto."
          : `${importedCount} turni importati dalla foto.`
      );
      setIsOpen(false);
      setSelectedFile(null);
      setRows([]);
    } catch (importError) {
      const reason = importError instanceof Error ? importError.message : "Importazione non riuscita.";
      setError(reason);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  const canConfirm = rows.length > 0 && rows.every((row) => buildRowErrors(row).length === 0);

  const buttonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  };

  const modal = isOpen && mounted ? (
    createPortal(
      <div
        className="dashboard-modal-wrap"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483647,
          display: "grid",
          placeItems: "center",
          padding: 16,
          background: "rgba(15, 23, 42, 0.32)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        onClick={handleClose}
      >
        <section
          className="dashboard-modal-panel"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: isMobileLayout ? "min(96vw, 520px)" : "min(92vw, 980px)",
            background: "rgba(255,255,255,0.98)",
            border: "1px solid rgba(226,232,240,0.9)",
            borderRadius: isMobileLayout ? 24 : 28,
            padding: isMobileLayout ? 16 : 22,
            boxShadow: "0 20px 48px rgba(15, 23, 42, 0.16)",
            overflow: "hidden",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <IconButton
            type="button"
            onClick={handleClose}
            aria-label="Chiudi import foto"
            disabled={busy}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 40,
              height: 40,
              color: "#475569",
              background: "#ffffff",
              zIndex: 2,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>

          <div style={{ display: "grid", gap: isMobileLayout ? 14 : 18, minWidth: 0 }}>
            <div style={{ display: "grid", gap: 4, paddingRight: 52 }}>
              <strong style={{ fontSize: isMobileLayout ? 18 : 22, color: "#0f172a" }}>
                Importa da foto
              </strong>
              {!isMobileLayout ? (
                <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
                  Carica o scatta una foto del foglio turni, poi controlla l&apos;anteprima prima di importare.
                </p>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobileLayout
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 1.15fr) minmax(0, 1fr)",
                gap: isMobileLayout ? 12 : 16,
                alignItems: "start",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: isMobileLayout ? 10 : 12,
                  padding: isMobileLayout ? 12 : 16,
                  borderRadius: 24,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                {!isMobileLayout ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <strong style={{ color: "#0f172a", fontSize: 15 }}>Foto caricata</strong>
                    <PrimaryButton
                      type="button"
                      tone="sand"
                      onClick={() => inputRef.current?.click()}
                      disabled={busy}
                    >
                      Cambia foto
                    </PrimaryButton>
                  </div>
                ) : (
                  <PrimaryButton
                    type="button"
                    tone="sand"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                  >
                    Cambia foto
                  </PrimaryButton>
                )}

                {previewUrl ? (
                  <div
                    style={{
                      borderRadius: 20,
                      overflow: "hidden",
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      minHeight: 240,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt="Anteprima turni"
                      style={{
                        width: "100%",
                        height: "100%",
                        maxHeight: isMobileLayout ? 240 : 360,
                        objectFit: "contain",
                        display: "block",
                        background: "#ffffff",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 20,
                      background: "#ffffff",
                      border: "1px dashed #cbd5e1",
                      minHeight: 240,
                      display: "grid",
                      placeItems: "center",
                      padding: 20,
                      textAlign: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4.5 8.5A2.5 2.5 0 0 1 7 6h2l1.2-1.8A2 2 0 0 1 11.85 3h.3a2 2 0 0 1 1.65 1.2L15 6h2.5A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
                          stroke="#64748b"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M12 16.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
                          stroke="#64748b"
                          strokeWidth="1.5"
                        />
                      </svg>
                      <strong style={{ color: "#0f172a" }}>Nessuna foto caricata</strong>
                      {!isMobileLayout ? (
                        <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                          Carica o scatta una foto del foglio turni per continuare.
                        </span>
                      ) : null}
                      <PrimaryButton type="button" tone="sand" onClick={() => inputRef.current?.click()} disabled={busy}>
                        Scegli foto
                      </PrimaryButton>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gap: 8 }}>
                  <PrimaryButton
                    type="button"
                    onClick={analyzePhoto}
                    disabled={busy || !selectedFile}
                    pendingLabel="Analisi in corso..."
                  >
                    Analizza foto
                  </PrimaryButton>
                  {!isMobileLayout ? (
                    <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                      File supportati: PNG, JPG, WEBP, GIF. Limite massimo 8MB.
                    </span>
                  ) : null}
                </div>

                {error ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 18,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      lineHeight: 1.5,
                    }}
                  >
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 18,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#475569",
                      lineHeight: 1.5,
                    }}
                  >
                    {message}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: isMobileLayout ? 10 : 12,
                  padding: isMobileLayout ? 12 : 16,
                  borderRadius: 24,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <strong style={{ color: "#0f172a", fontSize: 15 }}>
                    {isMobileLayout ? "Turni" : "Anteprima modificabile"}
                  </strong>
                  <IconButton type="button" onClick={addManualRow} aria-label="Aggiungi turno">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconButton>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    maxHeight: isMobileLayout ? "38vh" : "60vh",
                    overflowY: "auto",
                    paddingRight: 4,
                    overscrollBehavior: "contain",
                  }}
                >
                  {rows.length === 0 ? (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 18,
                        background: "#f8fafc",
                        border: "1px dashed #cbd5e1",
                        color: "#64748b",
                        lineHeight: 1.5,
                      }}
                    >
                      Nessun turno ancora importato.
                    </div>
                  ) : (
                    rows.map((row, index) => {
                      const rowErrors = buildRowErrors(row);

                      return (
                        <div
                          key={row.id}
                          style={{
                            display: "grid",
                            gap: isMobileLayout ? 10 : 12,
                            padding: isMobileLayout ? 12 : 14,
                            borderRadius: 20,
                            background: "#f8fafc",
                            border: `1px solid ${rowErrors.length > 0 ? "#fecaca" : "#e2e8f0"}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                              <strong style={{ color: "#0f172a", fontSize: 14 }}>
                                {row.employeeName || `Turno ${index + 1}`}
                              </strong>
                              {!isMobileLayout ? (
                                <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                                  {row.matchStatus === "matched" ? "Dipendente abbinato" : "Dipendente da correggere"}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <span
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: 999,
                                  background: row.matchStatus === "matched" ? "#dcfce7" : "#fef3c7",
                                  color: row.matchStatus === "matched" ? "#166534" : "#92400e",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {row.matchStatus === "matched" ? "OK" : "!"}
                              </span>
                              <span
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: 999,
                                  background: "#e2e8f0",
                                  color: "#334155",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {formatConfidence(row.confidence)}
                              </span>
                              <IconButton
                                type="button"
                                onClick={() => removeRow(row.id)}
                                aria-label={`Rimuovi turno ${index + 1}`}
                                style={{ width: 34, height: 34, color: "#94a3b8", boxShadow: "none", flexShrink: 0 }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path
                                    d="M6 6l12 12M18 6 6 18"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </IconButton>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gap: 10,
                              gridTemplateColumns: isMobileLayout
                                ? "minmax(0, 1fr)"
                                : "minmax(0, 1.1fr) minmax(0, 0.9fr)",
                            }}
                          >
                            <Select
                              value={row.employeeId}
                              onChange={(event) => {
                                const member = members.find((entry) => entry.id === event.target.value) ?? null;

                                updateRow(row.id, {
                                  employeeId: member?.id ?? "",
                                  employeeName: member ? `${member.firstName} ${member.lastName}`.trim() : "",
                                  matchStatus: member ? "matched" : "unmatched",
                                });
                              }}
                            >
                              <option value="">Seleziona dipendente</option>
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {formatMemberLabel(member)}
                                </option>
                              ))}
                            </Select>

                            <TextInput
                              type="date"
                              value={row.date}
                              onChange={(event) =>
                                updateRow(row.id, {
                                  date: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gap: 10,
                              gridTemplateColumns: isMobileLayout
                                ? "minmax(0, 1fr)"
                                : "minmax(0, 1fr) minmax(0, 1fr)",
                            }}
                          >
                            <TimeInput
                              value={row.startTime}
                              onChange={(value) =>
                                updateRow(row.id, {
                                  startTime: value,
                                })
                              }
                              style={{ width: "100%" }}
                            />

                            <TimeInput
                              value={row.endTime}
                              onChange={(value) =>
                                updateRow(row.id, {
                                  endTime: value,
                                })
                              }
                              style={{ width: "100%" }}
                            />
                          </div>

                          <label style={{ display: "grid", gap: 6 }}>
                            {!isMobileLayout ? (
                              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Note</span>
                            ) : null}
                            <TextInput
                              value={row.notes}
                              onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                              placeholder="Facoltativo"
                            />
                          </label>

                          {rowErrors.length > 0 ? (
                            <div
                              style={{
                                color: "#b91c1c",
                                fontSize: 13,
                                lineHeight: 1.5,
                              }}
                            >
                              {rowErrors[0]}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="dashboard-modal-actions" style={{ paddingTop: 4 }}>
                  <PrimaryButton
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={busy || !canConfirm || rows.length === 0}
                    pendingLabel="Importazione in corso..."
                  >
                    Conferma e importa turni
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <PrimaryButton
        type="button"
        onClick={openPicker}
        disabled={disabled || busy}
        pendingLabel="Apertura..."
        style={buttonStyle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4.5 8.5A2.5 2.5 0 0 1 7 6h2l1.2-1.8A2 2 0 0 1 11.85 3h.3a2 2 0 0 1 1.65 1.2L15 6h2.5A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 16.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
        Importa da foto
      </PrimaryButton>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {message ? (
        <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4, maxWidth: 220 }}>
          {message}
        </span>
      ) : null}

      {modal}
    </div>
  );
}
