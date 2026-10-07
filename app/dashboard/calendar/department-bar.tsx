import Link from "next/link";
import type { Department } from "@prisma/client";
import type { DepartmentInfo } from "@/lib/departments";

/**
 * Above the week, on a Pro venue: "Tutti" and the departments when the
 * calendar is one, a tab per department when each has its own. A link each,
 * so the week below is the same calendar as ever, just with fewer shifts.
 */
export function DepartmentBar({
  departments,
  active,
  separate,
  locked,
  lead,
  hrefs,
}: {
  departments: DepartmentInfo[];
  active: Department | null;
  separate: boolean;
  /** A lead or an employee on separate calendars sees only their own tab. */
  locked: boolean;
  lead: { name: string; department: DepartmentInfo } | null | "none";
  /** Where each chip leads, keyed by department or "TUTTI". */
  hrefs: Record<string, string>;
}) {
  const chip = (key: string, label: string, href: string, on: boolean, colors: { ink: string; soft: string } | null, disabled: boolean) => {
    const style = {
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 32,
      padding: "0 13px",
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 800,
      textDecoration: "none",
      background: on ? colors?.ink ?? "#17161f" : colors?.soft ?? "#ffffff",
      color: on ? "#ffffff" : colors?.ink ?? "#4c4670",
      boxShadow: on ? "none" : "0 0 0 1px #ebe6f7",
      opacity: disabled ? 0.35 : 1,
      pointerEvents: disabled ? ("none" as const) : undefined,
    };
    const dot = colors ? (
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: on ? "#ffffff" : colors.ink }} />
    ) : null;
    return (
      <Link key={key} href={href} scroll={false} aria-current={on ? "page" : undefined} aria-disabled={disabled || undefined} style={style}>
        {dot}
        {label}
      </Link>
    );
  };

  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 2px 4px", scrollbarWidth: "none" }}>
        {separate ? null : chip("all", "Tutti", hrefs.TUTTI, active === null, null, locked)}
        {departments.map((department) =>
          chip(
            department.id,
            department.name,
            hrefs[department.id],
            active === department.id,
            department,
            locked && active !== department.id
          )
        )}
      </div>
      {separate && lead ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#ffffff",
            borderRadius: 18,
            padding: "10px 14px",
            boxShadow: "0 0 0 1px #ebe6f7",
            fontSize: 13,
          }}
        >
          {lead === "none" ? (
            <span style={{ display: "grid", gap: 1 }}>
              <strong>Nessun capo reparto</strong>
              <span style={{ color: "#8a84a8", fontSize: 11.5 }}>Lo scegli dal Team. Intanto gestisce il titolare.</span>
            </span>
          ) : (
            <span style={{ display: "grid", gap: 1 }}>
              <strong>{lead.name}</strong>
              <span style={{ color: "#8a84a8", fontSize: 11.5 }}>
                Capo {lead.department.name.toLowerCase()} · turni, ferie e cambi
              </span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
