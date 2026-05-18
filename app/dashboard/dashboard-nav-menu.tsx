"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import type { DashboardNavItem } from "./context";

export function DashboardNavMenu({
  navItems,
  menuLabel,
}: {
  navItems: DashboardNavItem[];
  menuLabel: string;
}) {
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 260 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function syncPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setPosition({
        top: rect.bottom + 12,
        left: Math.max(18, rect.left),
        width: Math.max(240, rect.width + 80),
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
          borderRadius: 999,
          padding: "11px 18px",
          background: "#f8fafc",
          color: "#0f172a",
          border: "1px solid #e2e8f0",
          fontWeight: 700,
          boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
          cursor: "pointer",
        }}
      >
        {menuLabel}
      </button>

      {mounted && open
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Chiudi menu"
                onClick={() => setOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.18)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  zIndex: 9998,
                  cursor: "default",
                }}
              />

              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  overflowY: "auto",
                  zIndex: 9999,
                  paddingTop: position.top,
                  paddingLeft: position.left,
                  paddingRight: 18,
                  paddingBottom: 18,
                }}
              >
                <nav
                  aria-label="Navigazione dashboard"
                  style={{
                    width: `min(${position.width}px, calc(100vw - 36px))`,
                    maxHeight: "calc(100vh - 32px)",
                    overflowY: "auto",
                    padding: 10,
                    borderRadius: 22,
                    border: "1px solid #e2e8f0",
                    background: "rgba(255,255,255,0.99)",
                    boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                    display: "grid",
                    gap: 8,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 10px 12px",
                      borderBottom: "1px solid #e2e8f0",
                      marginBottom: 4,
                    }}
                  >
                    <BrandLogo
                      href={navItems[0]?.href ?? "/dashboard"}
                      size={38}
                      style={{ gap: 12 }}
                    />
                  </div>

                  {navItems.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        style={{
                          textDecoration: "none",
                          borderRadius: 16,
                          padding: "12px 14px",
                          background: active ? "#e2e8f0" : "#f8fafc",
                          color: "#0f172a",
                          border: "1px solid #e2e8f0",
                          fontWeight: 600,
                        }}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
