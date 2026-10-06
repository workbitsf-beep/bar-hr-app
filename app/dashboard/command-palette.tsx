"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardNavItem } from "./context";

/**
 * Ctrl K (⌘K on a Mac) on a computer: type a few letters and go. It lists the
 * sections the person can open plus a few things people do often; nothing
 * here can do more than the menu already allows.
 */

type Entry = { label: string; hint: string; href: string };

const SHORTCUTS: Array<Entry & { needs: string }> = [
  { label: "Nuovo turno", hint: "Turni", href: "/dashboard/calendar", needs: "/dashboard/calendar" },
  { label: "Nuova nota", hint: "Note", href: "/dashboard/tasks", needs: "/dashboard/tasks" },
  { label: "Chiedi ferie o permesso", hint: "Richieste", href: "/dashboard/requests", needs: "/dashboard/requests" },
  { label: "Richieste da decidere", hint: "Richieste", href: "/dashboard/requests", needs: "/dashboard/requests" },
  { label: "Timbrature con anomalie", hint: "Timbrature", href: "/dashboard/timelogs?f=anomalie", needs: "/dashboard/timelogs" },
  { label: "Chi è dentro adesso", hint: "Timbrature", href: "/dashboard/timelogs?f=dentro", needs: "/dashboard/timelogs" },
  { label: "Scarica il report del mese", hint: "Report", href: "/dashboard/export", needs: "/dashboard/export" },
  { label: "Carica un documento", hint: "Documenti", href: "/dashboard/documents", needs: "/dashboard/documents" },
];

export function CommandPalette({ navItems }: { navItems: DashboardNavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const allowed = new Set(navItems.map((item) => item.href));
    return [
      ...navItems.map((item) => ({ label: item.label, hint: "Vai a", href: item.href })),
      ...SHORTCUTS.filter((shortcut) => allowed.has(shortcut.needs)),
    ];
  }, [navItems]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((entry) => `${entry.label} ${entry.hint}`.toLowerCase().includes(q)) : entries;
  }, [entries, query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && window.innerWidth >= 1100) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    router.push(entry.href);
  }

  return (
    <>
      <button type="button" className="wb-cmd-trigger" onClick={() => setOpen(true)}>
        <span>Cerca o vai a…</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open ? (
        <div className="wb-cmd-bg" role="dialog" aria-modal="true" aria-label="Cerca" onClick={() => setOpen(false)}>
          <div className="wb-cmd" onClick={(event) => event.stopPropagation()}>
            <input
              ref={inputRef}
              value={query}
              placeholder="Cerca una sezione o un'azione"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((index) => Math.min(index + 1, shown.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(shown[active]);
                }
              }}
            />
            <div className="wb-cmd-list" role="listbox">
              {shown.length === 0 ? <p className="wb-cmd-empty">Niente con questo nome.</p> : null}
              {shown.map((entry, index) => (
                <button
                  key={`${entry.label}-${entry.href}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "wb-cmd-item wb-cmd-item--on" : "wb-cmd-item"}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(entry)}
                >
                  <b>{entry.label}</b>
                  <small>{entry.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
