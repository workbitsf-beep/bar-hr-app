"use client";

import { useState } from "react";
import type { Department } from "@prisma/client";
import type { DepartmentInfo } from "@/lib/departments";
import { ActionForm } from "@/app/components/action-form";
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSIONS,
  type Permission,
} from "@/lib/staff-permissions";
import { DepartmentChip } from "../department-forms";
import { PrimaryButton } from "../ui";
import { updateStaffRoleAction } from "./staff-role-actions";

type StaffRole = "EMPLOYEE" | "MANAGER" | "AMMINISTRAZIONE";

const label = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#8a84a8",
} as const;

/**
 * In a person's card, for the owner: Dipendente, Responsabile or (in a
 * company) Amministrazione; for the whole venue or some departments or
 * sites; and which of the eight things they may do there.
 */
export function StaffRoleForm({
  membershipId,
  firstName,
  isCompany,
  role,
  permissions,
  managesDepartments,
  departments,
  kind,
}: {
  membershipId: string;
  firstName: string;
  isCompany: boolean;
  role: StaffRole;
  permissions: string[];
  managesDepartments: Department[];
  /** The venue's departments or sites; null without them. */
  departments: DepartmentInfo[] | null;
  kind: "departments" | "sites";
}) {
  const [current, setCurrent] = useState<StaffRole>(role);
  const [allowed, setAllowed] = useState<Permission[]>(
    PERMISSIONS.filter((permission) => permissions.includes(permission))
  );
  const [whole, setWhole] = useState(managesDepartments.length === 0);
  const [picked, setPicked] = useState<Department[]>(managesDepartments);

  const staff = current !== "EMPLOYEE";
  const sites = kind === "sites";
  const roles: Array<{ value: StaffRole; title: string }> = [
    { value: "EMPLOYEE", title: "Dipendente" },
    { value: "MANAGER", title: "Responsabile" },
    ...(isCompany ? [{ value: "AMMINISTRAZIONE" as const, title: "Amministrazione" }] : []),
  ];

  function chooseRole(next: StaffRole) {
    setCurrent(next);
    // A new responsabile starts from the usual set, the owner trims it.
    if (next !== "EMPLOYEE" && (current === "EMPLOYEE" || allowed.length === 0)) {
      setAllowed(DEFAULT_PERMISSIONS[next]);
    }
  }

  const pickedNames = (departments ?? []).filter((entry) => picked.includes(entry.id)).map((entry) => entry.name);
  const whereWords = !departments || whole || pickedNames.length === 0
    ? sites
      ? "tutte le sedi"
      : "tutto il locale"
    : pickedNames.join(", ");
  const roleWord = current === "MANAGER" ? "responsabile" : "amministrazione";
  const saveLabel = staff ? `Salva: ${roleWord} · ${whereWords}` : "Salva: dipendente";
  const success = staff ? `${firstName} è ${roleWord} · ${whereWords}.` : `${firstName} ora è dipendente.`;

  return (
    <ActionForm action={updateStaffRoleAction} success={success} style={{ display: "grid", gap: 16 }}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="role" value={current} />
      <input type="hidden" name="scope" value={whole ? "all" : "some"} />
      {!whole ? picked.map((id) => <input key={id} type="hidden" name="departments" value={id} />) : null}
      {staff ? allowed.map((permission) => <input key={permission} type="hidden" name="permissions" value={permission} />) : null}

      <div style={{ display: "grid", gap: 8 }}>
        <span style={label}>Ruolo</span>
        <div
          role="radiogroup"
          aria-label="Ruolo"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))`,
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: "#f2f0fa",
          }}
        >
          {roles.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={current === option.value}
              onClick={() => chooseRole(option.value)}
              style={{
                minHeight: 40,
                borderRadius: 999,
                border: 0,
                background: current === option.value ? "#ffffff" : "transparent",
                boxShadow: current === option.value ? "0 2px 8px rgba(60,40,140,0.12)" : "none",
                fontSize: 13,
                fontWeight: current === option.value ? 800 : 650,
                color: current === option.value ? "#17161f" : "#6b6880",
                cursor: "pointer",
                padding: "0 4px",
              }}
            >
              {option.title}
            </button>
          ))}
        </div>
      </div>

      {staff && departments && departments.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span style={label}>{sites ? "Per quali sedi" : "Per quali reparti"}</span>
          <ScopeCard
            on={whole}
            title={sites ? "Tutte le sedi" : "Tutto il locale"}
            lead={sites ? "Lavora per tutta l'azienda" : "Responsabile generale"}
            onClick={() => setWhole(true)}
          />
          <ScopeCard
            on={!whole}
            title={sites ? "Alcune sedi" : "Alcuni reparti"}
            lead={
              sites
                ? "Vede persone, ore e documenti solo di quelle sedi"
                : "Vede persone e turni solo di quei reparti, più il Jolly"
            }
            onClick={() => setWhole(false)}
          >
            {!whole ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {departments.map((entry) => (
                  <DepartmentChip
                    key={entry.id}
                    department={entry}
                    active={picked.includes(entry.id)}
                    onClick={() =>
                      setPicked((list) =>
                        list.includes(entry.id) ? list.filter((value) => value !== entry.id) : [...list, entry.id]
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </ScopeCard>
        </div>
      ) : null}

      {staff ? (
        <div style={{ display: "grid" }}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 4 }}>
            <span style={label}>Cosa può fare</span>
            <span style={{ fontSize: 12, color: "#5b3fd6", fontWeight: 700 }}>
              {allowed.length} di {PERMISSIONS.length}
            </span>
          </span>
          {PERMISSIONS.map((permission) => {
            const on = allowed.includes(permission);
            const text = PERMISSION_LABELS[permission];
            return (
              <div
                key={permission}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid #f1eefa" }}
              >
                <span style={{ flex: 1, display: "grid" }}>
                  <strong style={{ fontSize: 14.5, fontWeight: 650 }}>{text.title}</strong>
                  <span style={{ fontSize: 12, color: "#8a84a8" }}>
                    {permission === "people" ? "Aggiunge e toglie dipendenti" : text.lead}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={text.title}
                  onClick={() =>
                    setAllowed((list) =>
                      on
                        ? list.filter((value) => value !== permission)
                        : PERMISSIONS.filter((value) => value === permission || list.includes(value))
                    )
                  }
                  style={{
                    width: 46,
                    height: 28,
                    flex: "0 0 auto",
                    borderRadius: 999,
                    border: 0,
                    position: "relative",
                    background: on ? "#6d3df0" : "#e4e1f0",
                    cursor: "pointer",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 3,
                      left: on ? 21 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                      transition: "left .15s",
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <PrimaryButton type="submit" pendingLabel="Salvo..." style={{ minHeight: 50 }}>
        {saveLabel}
      </PrimaryButton>
    </ActionForm>
  );
}

function ScopeCard({
  on,
  title,
  lead,
  onClick,
  children,
}: {
  on: boolean;
  title: string;
  lead: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 16,
        border: on ? "2px solid #6d3df0" : "1px solid #e9e6f5",
        background: on ? "#faf7ff" : "#ffffff",
      }}
    >
      <button
        type="button"
        aria-pressed={on}
        onClick={onClick}
        style={{
          display: "grid",
          gap: 2,
          textAlign: "left",
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <strong style={{ fontSize: 14.5 }}>{title}</strong>
        <span style={{ fontSize: 12, color: "#8a84a8" }}>{lead}</span>
      </button>
      {children}
    </div>
  );
}
