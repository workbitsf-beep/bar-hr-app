"use client";

import { useState, type ReactNode } from "react";
import type { Department } from "@prisma/client";
import type { DepartmentInfo } from "@/lib/departments";
import { CrewSwipe } from "./today-crew";

export type CrewRow = {
  id: string;
  shiftId: string;
  initials: string;
  name: string;
  from: string;
  to: string;
  tone: "in" | "out" | "waiting" | "late" | "next";
  label: string;
  department: DepartmentInfo | null;
};

/**
 * "In servizio oggi" on a Pro venue: a tile per department with a ring of who
 * is in and a word when someone is late, above the list of always. Touching a
 * tile narrows the list to that department; touching it again shows everyone.
 */
export function CrewBoard({
  rows,
  departments,
  addShift,
}: {
  rows: CrewRow[];
  departments: DepartmentInfo[];
  /** "Turno al volo", next to the count. */
  addShift?: ReactNode;
}) {
  const [picked, setPicked] = useState<Department | null>(null);
  // Jolly has no tile: whoever is on a Jolly shift counts in every department.
  const inDepartment = (row: CrewRow, id: Department) => row.department?.id === id || row.department?.id === "JOLLY";
  const tiles = departments
    .map((department) => {
      const mine = rows.filter((row) => inDepartment(row, department.id));
      return {
        department,
        total: mine.length,
        inside: mine.filter((row) => row.tone === "in").length,
        late: mine.filter((row) => row.tone === "late").length,
      };
    });
  const shown = picked ? rows.filter((row) => inDepartment(row, picked)) : rows;
  const inside = shown.filter((row) => row.tone === "in").length;
  const pickedName = departments.find((department) => department.id === picked)?.name;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tiles.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(tiles.length, 4)}, minmax(0, 1fr))`, gap: 8 }}>
          {tiles.map(({ department, total, inside: tileInside, late }) => {
            const on = picked === department.id;
            const share = total ? Math.round((tileInside / total) * 100) : 0;
            const note = total === 0 ? "nessuno oggi" : late ? (late === 1 ? "1 in ritardo" : `${late} in ritardo`) : "tutti puntuali";
            return (
              <button
                key={department.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(on ? null : department.id)}
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: 4,
                  padding: "12px 4px 10px",
                  borderRadius: 20,
                  border: "none",
                  background: "#ffffff",
                  boxShadow: on ? `0 0 0 2px ${department.ink}` : "0 0 0 1px #ebe6f7",
                  cursor: "pointer",
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: `conic-gradient(${department.ink} ${share}%, ${department.soft} 0)`,
                  }}
                >
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 999,
                      background: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 900,
                      fontVariantNumeric: "tabular-nums",
                      color: "#17161f",
                    }}
                  >
                    {tileInside}/{total}
                  </span>
                </span>
                <b style={{ fontSize: 13, color: department.ink }}>{department.name}</b>
                <small style={{ fontSize: 10.5, fontWeight: 700, color: late ? "#be123c" : "#8a84a8" }}>
                  {note}
                </small>
              </button>
            );
          })}
        </div>
      ) : null}

      <section className="workbit-crew">
        <div className="workbit-crew-head">
          <strong>{pickedName ?? "In servizio oggi"}</strong>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {shown.length > 0 ? (
              <span>
                {inside} su {shown.length} dentro
              </span>
            ) : null}
            {addShift}
          </span>
        </div>

        {shown.length === 0 ? (
          <span style={{ color: "#667085", fontSize: 13.5 }}>Nessun turno programmato per oggi.</span>
        ) : (
          shown.map((person) => (
            <CrewSwipe key={person.id} shiftId={person.shiftId} userId={person.id} name={person.name} from={person.from} to={person.to}>
            <div className="workbit-crew-person">
              <span className="workbit-crew-avatar" aria-hidden="true" style={{ position: "relative" }}>
                {person.initials}
                {person.department ? (
                  <span
                    style={{
                      position: "absolute",
                      right: -3,
                      bottom: -3,
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: person.department.ink,
                      color: "#ffffff",
                      fontSize: 8.5,
                      fontWeight: 900,
                      display: "grid",
                      placeItems: "center",
                      border: "2px solid #ffffff",
                    }}
                  >
                    {person.department.initials}
                  </span>
                ) : null}
              </span>
              <span className="workbit-crew-who">
                <b>{person.name}</b>
                <span>
                  {person.from} – {person.to}
                </span>
              </span>
              <span className={`workbit-crew-state workbit-crew-state--${person.tone}`}>{person.label}</span>
            </div>
            </CrewSwipe>
          ))
        )}
      </section>
    </div>
  );
}
