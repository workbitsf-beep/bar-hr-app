"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

export function PopupAction({
  title,
  ariaLabel,
  children,
  className,
  closeOnSubmit = false,
  initialOpen = false,
  triggerContent,
}: {
  title: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  closeOnSubmit?: boolean;
  initialOpen?: boolean;
  triggerContent?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialOpen) {
      setOpen(true);
    }
  }, [initialOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => setOpen(true)}
        className={className}
        style={{
          width: triggerContent ? "auto" : 40,
          minWidth: 40,
          height: 40,
          borderRadius: 999,
          border: "1px solid rgba(226, 232, 240, 0.96)",
          background: "#f8fafc",
          color: "#0f172a",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: triggerContent ? "0 14px" : 0,
          fontWeight: 800,
          boxShadow: "0 10px 18px rgba(15, 23, 42, 0.08)",
          cursor: "pointer",
        }}
      >
        {triggerContent ?? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="dashboard-modal-wrap"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483647,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label={`Chiudi ${title}`}
                onClick={() => setOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(8px)",
                  cursor: "pointer",
                }}
              />

              <section
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="dashboard-modal-panel"
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: "min(94vw, 720px)",
                  maxWidth: "calc(100vw - 32px)",
                  maxHeight: "calc(100dvh - 32px)",
                  overflowY: "auto",
                  overflowX: "hidden",
                  padding: "clamp(14px, 4vw, 18px)",
                  borderRadius: 28,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
                  display: "grid",
                  gap: 16,
                  boxSizing: "border-box",
                }}
                onSubmitCapture={
                  closeOnSubmit
                    ? () => {
                        window.setTimeout(() => {
                          setOpen(false);
                        }, 0);
                      }
                    : undefined
                }
                onClickCapture={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest("[data-popup-close]")) {
                    setOpen(false);
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <strong style={{ fontSize: 20, color: "#0f172a" }}>{title}</strong>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={`Chiudi ${title}`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#475569",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6 6 18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {children}
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
