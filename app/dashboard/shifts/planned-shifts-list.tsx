"use client";

import { useMemo, useState } from "react";
import type { ShiftPreset } from "@/lib/shift-presets";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { ShiftEditorModal } from "./shift-editor-modal";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ShiftOption = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  confirmedAt: string | null;
  isOnCall: boolean;
  assignments: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  createdBy?: {
    firstName: string;
    lastName: string;
  } | null;
  highlight?: boolean;
};

function formatDayTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function PlannedShiftsList({
  locale,
  canManage,
  shifts,
  members,
  presets,
  currentUserId,
}: {
  locale: string;
  canManage: boolean;
  shifts: ShiftOption[];
  members: MemberOption[];
  presets: ShiftPreset[];
  currentUserId: string;
}) {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? null,
    [selectedShiftId, shifts]
  );

  return (
    <>
      <div className="dashboard-scroll-list" style={{ display: "grid", gap: 10 }}>
        {shifts.map((shift) => (
          <button
            key={shift.id}
            type="button"
            onClick={() => setSelectedShiftId(shift.id)}
            className="dashboard-list-button"
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 20,
              border: shift.highlight ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
              background: shift.highlight ? "#f1f5f9" : "#f8fafc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ color: "#0f172a" }}>{shift.title || "Il tuo turno"}</strong>
              <span style={{ color: "#475569", fontSize: 14 }}>
                {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
              </span>
              <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
                {shift.assignments
                  .map((assignment) => `${assignment.firstName} ${assignment.lastName}`)
                  .join(", ")}
              </span>
              {shift.isOnCall ? (
                <span style={{ color: "#b45309", fontSize: 12, fontWeight: 600 }}>
                  Reperibilita {shift.confirmedAt ? "confermata" : "da approvare"}
                </span>
              ) : null}
            </div>

            <span
              className="dashboard-list-button-arrow"
              style={{
                color: "#64748b",
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              &rsaquo;
            </span>
          </button>
        ))}
      </div>

      <ShiftEditorModal
        open={Boolean(selectedShift)}
        locale={locale}
        canManage={canManage}
        currentUserId={currentUserId}
        shift={selectedShift}
        members={members}
        presets={presets}
        onClose={() => setSelectedShiftId(null)}
      />
    </>
  );
}
