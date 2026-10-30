"use client";

import type { CSSProperties } from "react";
import { showAppToast } from "@/app/components/app-toast";

/** Copies a value (an IBAN, a causale) and says so. */
export function CopyButton({ value, label, style }: { value: string; label: string; style?: CSSProperties }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => showAppToast(`${label} copiato`))
          .catch(() => showAppToast("Non riesco a copiare: tienilo premuto e copialo a mano.", "error"));
      }}
      style={style}
    >
      Copia {label.toLowerCase()}
    </button>
  );
}
