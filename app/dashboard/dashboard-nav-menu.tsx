"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import type { DashboardNavItem } from "./context";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export function DashboardNavMenu({
  navItems,
  menuLabel,
  menuContent,
}: {
  navItems: DashboardNavItem[];
  menuLabel: string;
  menuContent?: ReactNode;
}) {
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    width: 280,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function syncViewportMode() {
      setIsMobile(window.innerWidth <= 900);
    }

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);

    return () => {
      window.removeEventListener("resize", syncViewportMode);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function syncPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      setIsMobile(window.innerWidth <= 900);

      if (!rect) {
        return;
      }

      setPosition({
        top: rect.bottom + 12,
        left: Math.max(18, rect.left),
        width: Math.max(260, rect.width + 96),
      });
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        className="dashboard-menu-button"
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          padding: 0,
          background: "#f8fafc",
          color: "#0f172a",
          border: "1px solid #e2e8f0",
          fontWeight: 700,
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          {menuLabel}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <>
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes dashboardMenuEnter {
                      from {
                        opacity: 0;
                        transform: translateY(14px) scale(0.98);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                      }
                    }
                  `,
                }}
              />

              <button
                type="button"
                aria-label="Chiudi menu"
                onClick={() => setOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.22)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  zIndex: 9998,
                  cursor: "default",
                }}
              />

              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  overflow: "hidden",
                  display: isMobile ? "grid" : "block",
                  placeItems: isMobile ? "center" : undefined,
                  padding: isMobile ? 12 : 0,
                }}
              >
                <nav
                  aria-label="Navigazione dashboard"
                  onClickCapture={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("[data-dashboard-menu-close='true']")) {
                      setOpen(false);
                    }
                  }}
                  onChangeCapture={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("[data-dashboard-menu-close='true']")) {
                      setOpen(false);
                    }
                  }}
                  style={{
                    position: isMobile ? "relative" : "absolute",
                    top: isMobile ? undefined : position.top,
                    left: isMobile ? undefined : position.left,
                    width: isMobile
                      ? "min(380px, calc(100vw - 24px))"
                      : `min(${Math.max(320, Math.min(position.width, 360))}px, calc(100vw - 36px))`,
                    maxHeight: isMobile ? "min(84vh, 720px)" : "calc(100vh - 32px)",
                    overflowY: "auto",
                    padding: 14,
                    borderRadius: 28,
                    border: "1px solid #e2e8f0",
                    background: "rgba(255,255,255,0.98)",
                    boxShadow: "0 28px 60px rgba(15, 23, 42, 0.20)",
                    display: "grid",
                    gap: 12,
                    animation: "dashboardMenuEnter 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                    touchAction: "pan-y",
                    overscrollBehavior: "contain",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 10px 12px",
                      borderBottom: "1px solid #e2e8f0",
                      marginBottom: 4,
                    }}
                  >
                    <BrandLogo
                      href={navItems[0]?.href ?? "/dashboard"}
                      size={38}
                      showIcon
                      label="Workbit ShiftHub"
                      style={{ gap: 12 }}
                    />

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Chiudi menu"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        color: "#0f172a",
                        fontSize: 20,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {navItems.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          data-dashboard-menu-close="true"
                          style={{
                            textDecoration: "none",
                            borderRadius: 18,
                            padding: "14px 16px",
                            background: active ? "#e2e8f0" : "#f8fafc",
                            color: "#0f172a",
                            border: "1px solid #e2e8f0",
                            fontWeight: 700,
                            fontSize: 16,
                            lineHeight: 1.35,
                          }}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>

                  {menuContent ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        paddingTop: 12,
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      {menuContent}
                    </div>
                  ) : null}
                </nav>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
