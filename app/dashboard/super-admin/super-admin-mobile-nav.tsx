"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useOverlayLock } from "../use-overlay-lock";
import { AdminIcon, superAdminItems, type AdminSection } from "./super-admin-ui";

export function SuperAdminMobileNav({
  section,
  title,
}: {
  section: AdminSection;
  title: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useOverlayLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <>
      <div className="super-admin-mobilebar">
        <button
          type="button"
          className="super-admin-mobilebar-toggle"
          aria-label="Apri il menu delle sezioni"
          onClick={() => setOpen(true)}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <span className="super-admin-mobilebar-title">{title}</span>
      </div>

      {mounted && open
        ? createPortal(
            <div className="super-admin-drawer-wrap">
              <button
                type="button"
                aria-label="Chiudi il menu"
                className="super-admin-drawer-backdrop"
                onClick={() => setOpen(false)}
              />

              <div className="super-admin-drawer">
                <div className="super-admin-drawer-head">
                  <div className="super-admin-sidebar-brand">
                    <span className="super-admin-sidebar-mark" aria-hidden="true" />
                    Super Admin
                  </div>
                  <button
                    type="button"
                    aria-label="Chiudi"
                    className="super-admin-drawer-close"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <nav className="super-admin-sidebar-nav">
                  {superAdminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="super-admin-sidebar-item"
                      aria-current={item.section === section ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <span className="super-admin-sidebar-icon" aria-hidden="true">
                        <AdminIcon section={item.section} />
                      </span>
                      {item.title}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>,
            document.body
          )
        : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .super-admin-mobilebar {
              display: none;
            }

            .super-admin-drawer-wrap {
              position: fixed;
              inset: 0;
              z-index: 2147483646;
              display: none;
            }

            .super-admin-drawer-backdrop {
              position: absolute;
              inset: 0;
              border: 0;
              background: rgba(11, 16, 36, 0.45);
              backdrop-filter: blur(2px);
            }

            .super-admin-drawer {
              position: relative;
              width: min(78vw, 300px);
              height: 100%;
              background: var(--workbit-navy);
              padding: 16px 12px;
              display: flex;
              flex-direction: column;
              gap: 16px;
              overflow-y: auto;
              box-shadow: 8px 0 32px rgba(0,0,0,0.22);
            }

            .super-admin-drawer-head {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 2px 4px;
            }

            .super-admin-drawer-close {
              width: 30px;
              height: 30px;
              border-radius: 999px;
              border: 0;
              background: rgba(255,255,255,0.08);
              color: #ffffff;
              font-size: 16px;
              line-height: 1;
              cursor: pointer;
            }

            @media (max-width: 900px) {
              .super-admin-mobilebar {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 4px;
              }

              .super-admin-mobilebar-toggle {
                width: 36px;
                height: 36px;
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                border: 1px solid var(--workbit-border);
                background: #ffffff;
                color: var(--workbit-ink);
                cursor: pointer;
              }

              .super-admin-mobilebar-title {
                font-size: 16px;
                font-weight: 700;
                color: var(--workbit-ink);
              }

              .super-admin-drawer-wrap {
                display: block;
              }
            }
          `,
        }}
      />
    </>
  );
}
