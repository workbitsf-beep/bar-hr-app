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
  const chip = (
    key: string,
    label: string,
    href: string,
    on: boolean,
    colors: { ink: string; soft: string; light: string } | null,
    disabled: boolean
  ) => {
    const ink = colors?.ink ?? "#17161f";
    const style = {
      minWidth: 0,
      height: 38,
      display: "grid",
      placeItems: "center",
      padding: "0 6px",
      borderRadius: 14,
      fontSize: 14,
      fontWeight: 800,
      whiteSpace: "nowrap" as const,
      textDecoration: "none",
      background: on
        ? `linear-gradient(160deg, ${colors?.light ?? "#2a2540"}, ${ink})`
        : colors?.soft ?? "#ffffff",
      color: on ? "#ffffff" : colors ? ink : "#4c4670",
      boxShadow: on
        ? `0 6px 14px color-mix(in srgb, ${ink} 35%, transparent)`
        : "0 0 0 1px rgba(23, 22, 31, 0.06)",
      opacity: disabled ? 0.35 : 1,
      pointerEvents: disabled ? ("none" as const) : undefined,
    };
    return (
      <Link key={key} href={href} scroll={false} aria-current={on ? "page" : undefined} aria-disabled={disabled || undefined} style={style}>
        {label}
      </Link>
    );
  };

  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)", gap: 6, padding: "2px 2px 4px" }}>
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
