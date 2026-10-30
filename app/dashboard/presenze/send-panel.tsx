"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showAppToast } from "@/app/components/app-toast";
import { isNativeApp, openMailDraft, shareFileFromUrl } from "@/lib/native-extras";
import { markSentAction } from "./actions";

const field = {
  minHeight: 40,
  borderRadius: 12,
  border: "1px solid #e9e6f5",
  padding: "0 11px",
  fontSize: 15,
  width: "100%",
  minWidth: 0,
  background: "#ffffff",
  color: "#1f1b3a",
} as const;

const label = { display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" } as const;

const primary = {
  minHeight: 46,
  borderRadius: 999,
  border: 0,
  color: "#ffffff",
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  boxShadow: "0 10px 22px rgba(124, 58, 237, 0.18)",
  fontSize: 14.5,
  fontWeight: 780,
  cursor: "pointer",
  padding: "0 18px",
} as const;

const secondary = {
  minHeight: 40,
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13.5,
  fontWeight: 740,
  cursor: "pointer",
  padding: "0 14px",
} as const;

type Props = {
  recipientId: string;
  firstName: string;
  /** The closed button's words; "Invia a <nome>" when left out. */
  label?: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  fileName: string;
  month: number;
  year: number;
};

function postExport(body: Record<string, unknown>) {
  return fetch("/api/export/consulente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/**
 * The month's mail, written and ready to change: who, subject, text, the
 * file. "Apri nella mail" opens it in the phone's mail app to send from the
 * owner's own address; on a computer the file is downloaded and the mail
 * program opens with the rest. Workbit can also send it, in their name.
 */
export function SendPanel(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [to, setTo] = useState(props.to);
  const [cc, setCc] = useState(props.cc);
  const [subject, setSubject] = useState(props.subject);
  const [body, setBody] = useState(props.body);
  const list = (value: string) => value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
  const monthKey = `${props.year}-${String(props.month).padStart(2, "0")}`;

  async function record(channel: string) {
    const result = await markSentAction({ recipientId: props.recipientId, month: monthKey, channel });
    if (result && "ruleError" in result) showAppToast(result.ruleError, "error");
    router.refresh();
  }

  async function openInMail() {
    if (!list(to).length) {
      showAppToast("Scrivi a chi mandarla.", "error");
      return;
    }
    setBusy("mail");
    try {
      if (isNativeApp()) {
        const response = await postExport({ month: props.month, year: props.year, recipientId: props.recipientId, mode: "compose" });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; files?: Array<{ name: string; base64: string }> } | null;
        if (!response.ok || !payload?.files) {
          showAppToast(payload?.message ?? "File non pronto.", "error");
          return;
        }
        const opened = await openMailDraft({ to: list(to), cc: list(cc), subject, body, files: payload.files });
        if (opened === "mail_app" || opened === "share") {
          await record(opened);
          showAppToast(opened === "mail_app" ? "Mail pronta: controlla e premi Invia" : "Scegli la tua app di posta");
          setOpen(false);
        } else if (opened === false) {
          showAppToast("Non si apre la mail su questo telefono: usa Invia da Workbit.", "error");
        }
        return;
      }

      // A computer: the file first, then the mail program with everything else.
      const response = await postExport({ month: props.month, year: props.year, recipientId: props.recipientId, mode: "download" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        showAppToast(payload?.message ?? "File non pronto.", "error");
        return;
      }
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = props.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      const query = [
        list(cc).length ? `cc=${encodeURIComponent(list(cc).join(","))}` : null,
        `subject=${encodeURIComponent(subject)}`,
        `body=${encodeURIComponent(body)}`,
      ]
        .filter(Boolean)
        .join("&");
      window.location.href = `mailto:${list(to).map(encodeURIComponent).join(",")}?${query}`;
      await record("mailto");
      showAppToast("File scaricato: allegalo alla mail e premi Invia");
      setOpen(false);
    } catch {
      showAppToast("Non riuscito: controlla la connessione.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function sendFromWorkbit() {
    setBusy("workbit");
    try {
      const response = await postExport({
        month: props.month,
        year: props.year,
        recipientId: props.recipientId,
        mode: "workbit",
        to,
        cc,
        subject,
        text: body,
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; sentTo?: string } | null;
      if (!response.ok || !payload?.ok) {
        showAppToast(payload?.message ?? "Email non partita.", "error");
        return;
      }
      showAppToast(`Inviata a ${payload.sentTo}, tu sei in copia`);
      setOpen(false);
      router.refresh();
    } catch {
      showAppToast("Email non partita: controlla la connessione.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("file");
    try {
      const inApp = isNativeApp();
      const response = await postExport({ month: props.month, year: props.year, recipientId: props.recipientId, mode: inApp ? "link" : "download" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        showAppToast(payload?.message ?? "File non disponibile.", "error");
        return;
      }
      if (inApp) {
        const payload = (await response.json().catch(() => null)) as { url?: string; fileName?: string } | null;
        if (!payload?.url) return showAppToast("Impossibile preparare il file.", "error");
        const link = new URL(payload.url, window.location.origin).toString();
        if (await shareFileFromUrl(link, payload.fileName ?? props.fileName, "Presenze del mese")) return;
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: link });
        return;
      }
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = props.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch {
      showAppToast("Download non riuscito: controlla la connessione.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
        <button type="button" style={primary} onClick={() => setOpen(true)}>
          {props.label ?? `Invia a ${props.firstName}`}
        </button>
        <button type="button" style={secondary} disabled={busy !== null} onClick={() => void download()}>
          {busy === "file" ? "Preparo…" : "File"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={label}>
        A
        <input value={to} onChange={(event) => setTo(event.currentTarget.value)} inputMode="email" style={field} />
      </label>
      <label style={label}>
        Copia
        <input value={cc} onChange={(event) => setCc(event.currentTarget.value)} inputMode="email" placeholder="facoltativo" style={field} />
      </label>
      <label style={label}>
        Oggetto
        <input value={subject} onChange={(event) => setSubject(event.currentTarget.value)} style={field} />
      </label>
      <label style={label}>
        Testo
        <textarea
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          rows={7}
          style={{ ...field, padding: "10px 11px", lineHeight: 1.45, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4b4763" }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: "#5e4ae3", flex: "0 0 auto" }} />
        Allegato: {props.fileName}
      </span>
      <button type="button" style={{ ...primary, opacity: busy ? 0.7 : 1 }} disabled={busy !== null} onClick={() => void openInMail()}>
        {busy === "mail" ? "Preparo la mail…" : "Apri nella mail"}
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={secondary} disabled={busy !== null} onClick={() => void sendFromWorkbit()}>
          {busy === "workbit" ? "Invio…" : "Invia da Workbit"}
        </button>
        <button type="button" style={{ ...secondary, background: "transparent", border: "1px solid transparent" }} onClick={() => setOpen(false)}>
          Chiudi
        </button>
      </div>
      <span style={{ fontSize: 12.5, color: "#7c7894" }}>
        Apri nella mail: parte dalla tua casella, la ritrovi tra le inviate. Invia da Workbit: parte a tuo nome, le risposte arrivano a te e sei in copia.
      </span>
    </div>
  );
}
