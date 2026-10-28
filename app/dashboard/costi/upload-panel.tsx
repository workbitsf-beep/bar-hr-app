"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { showAppToast } from "@/app/components/app-toast";

type Summary = {
  found: number;
  imported: number;
  duplicates: number;
  skipped: number;
  failed: number;
  notes: string[];
  months: string[];
};

/**
 * The month's zip from the cassetto fiscale, or loose XML and P7M files.
 * Says what it found, what it saved and what it left out, and why.
 */
export function UploadPanel({ compact = false, allowAnyRecipient = false }: { compact?: boolean; allowAnyRecipient?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [anyRecipient, setAnyRecipient] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setSummary(null);
    const form = new FormData();
    for (const file of Array.from(files)) form.append("files", file);
    if (anyRecipient) form.append("anyRecipient", "1");
    try {
      const response = await fetch("/api/costs/upload", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; summary?: Summary } | null;
      if (!response.ok || !payload?.ok || !payload.summary) {
        showAppToast(payload?.message ?? "Caricamento non riuscito.", "error");
        return;
      }
      const result = payload.summary;
      setSummary(result);
      showAppToast(
        result.imported
          ? `${result.imported} ${result.imported === 1 ? "fattura caricata" : "fatture caricate"}`
          : result.duplicates
            ? "Erano già tutte caricate"
            : "Nessuna fattura trovata nel file",
        result.imported || result.duplicates ? "ok" : "error",
      );
      const latest = result.months.at(-1);
      router.push(latest ? `/dashboard/costi?month=${latest}` : "/dashboard/costi");
      router.refresh();
    } catch {
      showAppToast("Caricamento non riuscito: controlla la connessione.", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        ref={input}
        type="file"
        multiple
        accept=".zip,.xml,.p7m,application/zip,application/xml,text/xml"
        style={{ display: "none" }}
        onChange={(event) => void upload(event.currentTarget.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        style={{
          minHeight: 46,
          borderRadius: 999,
          border: 0,
          background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
          color: "#ffffff",
          fontSize: 14.5,
          fontWeight: 780,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
          boxShadow: "0 10px 22px rgba(124, 58, 237, 0.18)",
        }}
      >
        {busy ? "Leggo le fatture…" : compact ? "Carica altre fatture" : "Carica lo zip delle fatture"}
      </button>

      {allowAnyRecipient ? (
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: "#7c7894" }}>
          <input type="checkbox" checked={anyRecipient} onChange={(event) => setAnyRecipient(event.currentTarget.checked)} />
          Prova: carica anche fatture intestate a un&apos;altra partita IVA (solo super admin)
        </label>
      ) : null}

      {summary ? (
        <div style={{ fontSize: 13, color: "#4b4763", display: "grid", gap: 4 }}>
          <span>
            Trovate {summary.found} · caricate {summary.imported}
            {summary.duplicates ? ` · già presenti ${summary.duplicates}` : ""}
            {summary.skipped ? ` · escluse ${summary.skipped}` : ""}
            {summary.failed ? ` · non lette ${summary.failed}` : ""}
          </span>
          {summary.notes.length ? (
            <details>
              <summary style={{ cursor: "pointer", color: "#6d5ce7" }}>Cosa è stato escluso e perché</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 2 }}>
                {summary.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
