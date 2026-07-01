"use client";

import { useEffect, useState, type ReactNode } from "react";

export function ConfirmationToast({
  children,
  duration = 1700,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timeout);
  }, [duration]);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "grid",
        placeItems: "center",
        padding: 24,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "min(86vw, 320px)",
          borderRadius: 28,
          border: "1px solid rgba(168, 85, 247, 0.18)",
          background: "rgba(255, 255, 255, 0.95)",
          boxShadow: "0 28px 70px rgba(36, 20, 77, 0.24)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          padding: "26px 22px",
          textAlign: "center",
          animation: "workbit-confirm-pop 170ms ease-out",
        }}
      >
        <svg
          aria-hidden="true"
          width="82"
          height="82"
          viewBox="0 0 60 60"
          style={{ display: "block", margin: "0 auto 14px" }}
        >
          <circle cx="30" cy="30" r="28" fill="#dcfce7" stroke="#86efac" strokeWidth="2" />
          <path
            className="workbit-confirm-check"
            d="M18 30.5l7.2 7.2L42 22"
            fill="none"
            stroke="#16a34a"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4.5"
          />
        </svg>
        <strong
          style={{
            display: "block",
            color: "#111827",
            fontSize: 19,
            lineHeight: 1.2,
            fontWeight: 900,
          }}
        >
          {children}
        </strong>
      </div>
      <style jsx>{`
        @keyframes workbit-confirm-pop {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .workbit-confirm-check {
          stroke-dasharray: 44;
          stroke-dashoffset: 44;
          animation: workbit-draw-check 520ms ease forwards 100ms;
        }

        @keyframes workbit-draw-check {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
