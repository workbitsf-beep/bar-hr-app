"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CourseKind } from "@prisma/client";
import { showAppToast } from "@/app/components/app-toast";
import { COURSE_KINDS, getCourseKind } from "@/lib/course-kinds";
import { isNativeApp, shareFileFromUrl } from "@/lib/native-extras";
import { saveCourseReminderDaysAction } from "./certificate-actions";

const field: CSSProperties = {
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid #e9e6f5",
  background: "#fbfaff",
  fontSize: 15.5,
  color: "#1f1b3a",
  padding: "0 12px",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

/** A date box with its value in the middle, as iOS otherwise puts it top-left. */
const dateField: CSSProperties = { ...field, height: 50, minHeight: 50, lineHeight: "50px", padding: "0 10px", textAlign: "center", display: "block" };

const label: CSSProperties = { display: "grid", gap: 6, fontSize: 12.5, color: "#6f6a88" };

const primary: CSSProperties = {
  minHeight: 50,
  borderRadius: 999,
  border: 0,
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  color: "#ffffff",
  fontSize: 15.5,
  fontWeight: 700,
  boxShadow: "0 10px 22px rgba(124,58,237,.2)",
  cursor: "pointer",
  width: "100%",
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** The expiry a kind suggests: the day before the anniversary. */
function suggestExpiry(kind: CourseKind, done: string) {
  const months = getCourseKind(kind).validForMonths;
  if (!months || !done) return "";
  const date = new Date(`${done}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <button type="button" aria-label="Chiudi" onClick={onClose} style={{ position: "absolute", inset: 0, border: 0, background: "rgba(31,27,58,.32)", cursor: "pointer" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "28px 28px 0 0",
          padding: "12px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          display: "grid",
          gap: 14,
          boxShadow: "0 -20px 40px rgba(31,27,58,.18)",
          color: "#1f1b3a",
        }}
      >
        <span aria-hidden style={{ width: 40, height: 5, borderRadius: 3, background: "#e4e1ef", justifySelf: "center" }} />
        <span style={{ fontSize: 21, fontWeight: 750, letterSpacing: "-0.02em" }}>{title}</span>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export type MemberOption = { id: string; name: string };

/**
 * A course done, for one person: which course, the day, until when (filled
 * in from the kind), and the certificate's photo or PDF straight from the
 * phone's camera or files.
 */
export function CertificateButton({
  members,
  selfId,
  preset,
  trigger,
  style,
}: {
  /** Whoever runs the courses picks the person; an employee adds their own. */
  members: MemberOption[] | null;
  selfId: string;
  preset?: { userId?: string; kind?: CourseKind; title?: string; completedAt?: string; courseId?: string };
  trigger: ReactNode;
  style: CSSProperties;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(preset?.userId ?? (members ? "" : selfId));
  const [kind, setKind] = useState<CourseKind>(preset?.kind ?? CourseKind.HACCP);
  const [title, setTitle] = useState(preset?.title ?? "");
  const [done, setDone] = useState(preset?.completedAt ?? todayKey());
  const [expiry, setExpiry] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const suggested = useMemo(() => suggestExpiry(kind, done), [kind, done]);
  const expiresAt = expiry ?? suggested;
  const fromCourse = Boolean(preset?.courseId);

  async function submit() {
    if (!userId) return showAppToast("Scegli la persona.", "error");
    if (kind === CourseKind.OTHER && !title.trim()) return showAppToast("Scrivi il nome del corso.", "error");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("userId", userId);
      form.append("kind", kind);
      form.append("title", kind === CourseKind.OTHER ? title : "");
      form.append("completedAt", done);
      form.append("expiresAt", expiresAt);
      if (preset?.courseId) form.append("courseId", preset.courseId);
      if (file) form.append("file", file);
      const response = await fetch("/api/courses/certificates", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        showAppToast(payload?.message ?? "Attestato non salvato.", "error");
        return;
      }
      showAppToast(file ? "Attestato salvato" : "Corso salvato: l'attestato puoi aggiungerlo dopo");
      setOpen(false);
      setFile(null);
      setExpiry(null);
      router.refresh();
    } catch {
      showAppToast("Attestato non salvato: controlla la connessione.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={style}>
        {trigger}
      </button>
      {open ? (
        <Sheet title={fromCourse ? "Corso fatto" : "Aggiungi un attestato"} onClose={() => setOpen(false)}>
          {members ? (
            <label style={label}>
              Chi
              <select value={userId} onChange={(event) => setUserId(event.currentTarget.value)} disabled={Boolean(preset?.userId)} style={field}>
                <option value="">Scegli la persona</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {fromCourse ? null : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {COURSE_KINDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setKind(item.id);
                    setExpiry(null);
                  }}
                  style={{
                    minHeight: 36,
                    borderRadius: 999,
                    border: kind === item.id ? "1px solid #6d5ce7" : "1px solid #e9e6f5",
                    background: kind === item.id ? "#f1eeff" : "#ffffff",
                    color: kind === item.id ? "#4c1d95" : "#4b4763",
                    fontSize: 13.5,
                    fontWeight: kind === item.id ? 700 : 600,
                    padding: "0 14px",
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {kind === CourseKind.OTHER && !fromCourse ? (
            <label style={label}>
              Nome del corso
              <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} maxLength={120} placeholder="Corso allergeni" style={field} />
            </label>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={label}>
              Fatto il
              <input type="date" className="wb-centered-field" value={done} max={todayKey()} onChange={(event) => setDone(event.currentTarget.value)} style={dateField} />
            </label>
            <label style={label}>
              Scade il
              <input type="date" className="wb-centered-field" value={expiresAt} min={done} onChange={(event) => setExpiry(event.currentTarget.value)} style={dateField} />
            </label>
          </div>
          {suggested && expiresAt === suggested ? (
            <span style={{ fontSize: 12.5, color: "#6f6a88", marginTop: -6 }}>
              {getCourseKind(kind).label} vale {getCourseKind(kind).validForMonths! / 12} anni: la scadenza è già calcolata.
            </span>
          ) : null}

          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            style={{
              minHeight: 64,
              borderRadius: 16,
              border: file ? "1px solid #10b981" : "1.5px dashed #d7d2ea",
              background: file ? "#effaf5" : "#fbfaff",
              color: file ? "#0f7a4f" : "#4c1d95",
              fontSize: 14.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "0 14px",
            }}
          >
            {file ? (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Attestato: {file.name}</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                Foto o PDF dell&apos;attestato
              </>
            )}
          </button>
          <span style={{ fontSize: 12.5, color: "#6f6a88", marginTop: -6 }}>Se l&apos;attestato non è ancora arrivato, salva lo stesso: lo aggiungi quando c&apos;è.</span>

          <button type="button" onClick={() => void submit()} disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Salvo…" : "Salva"}
          </button>
        </Sheet>
      ) : null}
    </>
  );
}

/** The certificate file for one already there. */
export function AddFileButton({ certificateId, style }: { certificateId: string; style: CSSProperties }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("certificateId", certificateId);
      form.append("file", file);
      const response = await fetch("/api/courses/certificates", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) return showAppToast(payload?.message ?? "Attestato non caricato.", "error");
      showAppToast("Attestato caricato");
      router.refresh();
    } catch {
      showAppToast("Attestato non caricato: controlla la connessione.", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(event) => void send(event.currentTarget.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} style={style}>
        {busy ? "Carico…" : "Carica attestato"}
      </button>
    </>
  );
}

/** Opens a certificate: a new tab in a browser, the phone's share sheet in the app. */
export function CertificateLink({ certificateId, fileName, style }: { certificateId: string; fileName: string; style: CSSProperties }) {
  const href = `/api/courses/certificates/${certificateId}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={style}
      onClick={(event) => {
        if (!isNativeApp()) return;
        event.preventDefault();
        void shareFileFromUrl(new URL(href, window.location.origin).toString(), fileName, "Attestato").then((shared) => {
          if (!shared) showAppToast("Attestato non disponibile.", "error");
        });
      }}
    >
      Attestato
    </a>
  );
}

/** How far ahead the first reminder goes. */
export function ReminderDays({ value }: { value: number }) {
  const router = useRouter();
  const [days, setDays] = useState(value);
  return (
    <select
      aria-label="Primo avviso prima della scadenza"
      value={days}
      onChange={(event) => {
        const next = Number(event.currentTarget.value);
        setDays(next);
        const form = new FormData();
        form.append("days", String(next));
        void saveCourseReminderDaysAction(form).then((result) => {
          if (result && "ruleError" in result) {
            showAppToast(result.ruleError, "error");
            setDays(value);
            return;
          }
          showAppToast(`Avviso ${next} giorni prima`);
          router.refresh();
        });
      }}
      style={{ minHeight: 36, borderRadius: 999, border: "1px solid #ddd6fe", background: "#f6f3ff", color: "#4c1d95", fontSize: 13.5, fontWeight: 700, padding: "0 12px" }}
    >
      {[30, 60, 90, 120].map((option) => (
        <option key={option} value={option}>
          {option} giorni prima
        </option>
      ))}
    </select>
  );
}
