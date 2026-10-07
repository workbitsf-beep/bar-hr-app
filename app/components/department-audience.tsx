"use client";

import { useEffect, useState } from "react";
import type { DepartmentInfo } from "@/lib/departments";

type AudienceDepartments = { list: DepartmentInfo[]; members: Record<string, string[]> };

let cached: Promise<AudienceDepartments | null> | null = null;

function loadDepartments() {
  cached ??= fetch("/api/dashboard/departments", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { ok?: boolean; enabled?: boolean; list?: DepartmentInfo[]; members?: Record<string, string[]> } | null) =>
      body?.ok && body.enabled && body.list?.length ? { list: body.list, members: body.members ?? {} } : null
    )
    .catch(() => {
      cached = null;
      return null;
    });
  return cached;
}

/**
 * Pro: "Solo cucina" next to the names wherever something is sent to people.
 * A department selects everyone who works in it or lends a hand there; touched
 * again, it lets them go. The note, task or document is then sent to those
 * people exactly as if each had been picked by hand. Nothing on a Base venue.
 */
export function DepartmentAudience({
  selectedIds,
  picked,
  onChange,
}: {
  selectedIds: string[];
  /** The department chosen, when the caller keeps one: one at a time then. */
  picked?: string;
  onChange: (ids: string[], department: string | null) => void;
}) {
  const [departments, setDepartments] = useState<AudienceDepartments | null>(null);

  useEffect(() => {
    let alive = true;
    loadDepartments().then((value) => {
      if (alive) setDepartments(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!departments) return null;

  return (
    <div style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 820, color: "#334155" }}>Reparto</span>
      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)", gap: 6 }}>
        {departments.list.map((department) => {
          const ids = departments.members[department.id] ?? [];
          const on = picked !== undefined ? picked === department.id : ids.length > 0 && ids.every((id) => selectedIds.includes(id));
          return (
            <button
              key={department.id}
              type="button"
              aria-pressed={on}
              disabled={ids.length === 0}
              title={ids.length === 0 ? `Nessuno in ${department.name.toLowerCase()}` : undefined}
              onClick={() =>
                picked !== undefined
                  ? // Notes: one department, its people, and the note filed under it.
                    on
                    ? onChange([], null)
                    : onChange(ids, department.id)
                  : onChange(
                      on ? selectedIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedIds, ...ids])),
                      null
                    )
              }
              style={{
                minWidth: 0,
                height: 38,
                display: "grid",
                placeItems: "center",
                padding: "0 6px",
                borderRadius: 14,
                border: "none",
                fontSize: 13.5,
                fontWeight: 800,
                whiteSpace: "nowrap",
                cursor: ids.length === 0 ? "not-allowed" : "pointer",
                opacity: ids.length === 0 ? 0.4 : 1,
                background: on ? `linear-gradient(160deg, ${department.light}, ${department.ink})` : department.soft,
                color: on ? "#ffffff" : department.ink,
                boxShadow: on
                  ? `0 6px 14px color-mix(in srgb, ${department.ink} 35%, transparent)`
                  : "0 0 0 1px rgba(23, 22, 31, 0.06)",
              }}
            >
              {department.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
