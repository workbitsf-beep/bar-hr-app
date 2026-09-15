"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ModalShell({
  open,
  onClose,
  title,
  header,
  closeLabel = "Chiudi",
  width = "min(92vw, 520px)",
  zIndex = 2147483646,
  wrapClassName,
  panelClassName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  header?: ReactNode;
  closeLabel?: string;
  width?: number | string;
  zIndex?: number;
  wrapClassName?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      className={wrapClassName}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <button
        type="button"
        aria-label={`Chiudi popup ${title}`}
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: 0,
          background: "rgba(15, 23, 42, 0.28)",
          backdropFilter: "blur(6px)",
        }}
      />

      <section
        className={panelClassName}
        style={{
          position: "relative",
          width,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          background: "rgba(255,255,255,0.98)",
          border: "1px solid #e2e8f0",
          borderRadius: 28,
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
          padding: 22,
          display: "grid",
          gap: 18,
          zIndex: 1,
        }}
      >
        {header ?? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
            <strong style={{ fontSize: 22, color: "#0f172a" }}>{title}</strong>

            <button
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              X
            </button>
          </div>
        )}

        {children}
      </section>
    </div>,
    document.body
  );
}
