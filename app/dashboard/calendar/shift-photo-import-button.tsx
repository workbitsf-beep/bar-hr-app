"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { IconButton } from "../ui";
import {
  parseShiftPhotoText,
  type ParsedShiftPhotoDraft,
  type ShiftPhotoMember,
} from "@/lib/shift-photo-parser";

type ImportResult = ParsedShiftPhotoDraft[];

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
  onImport: (drafts: ImportResult) => Promise<number> | number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || busy || disabled) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "ita+eng", {
        logger: () => void 0,
      });
      const drafts = parseShiftPhotoText(result.data.text ?? "", members, rangeStart, rangeEnd);

      if (drafts.length === 0) {
        setMessage("Non sono riuscito a leggere turni validi dalla foto.");
        return;
      }

      const importedCount = await onImport(drafts);
      setMessage(
        `${importedCount || drafts.length} turni importati dalla foto.`
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Importazione non riuscita.";
      setMessage(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <IconButton
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Importa turni da foto"
        disabled={disabled || busy}
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
      </IconButton>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {message ? (
        <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4, maxWidth: 180 }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
