"use client";

import { useMemo, useState } from "react";
import { applyShiftPreset, type ShiftPreset } from "@/lib/shift-presets";
import { FormField, PrimaryButton, Select, TextInput } from "../ui";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

function toDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatRoleLabel(role: string) {
  if (role === "MANAGER") {
    return "Manager";
  }

  if (role === "OWNER") {
    return "Titolare";
  }

  return "Dipendente";
}

export function ShiftCreateForm({
  action,
  members,
  presets,
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
  presets: ShiftPreset[];
}) {
  const defaultStartTime = useMemo(() => toDateTimeLocal(new Date()), []);
  const defaultEndTime = useMemo(() => {
    const end = new Date();
    end.setHours(end.getHours() + 8);
    return toDateTimeLocal(end);
  }, []);
  const [selectedPresetKey, setSelectedPresetKey] = useState("CUSTOM");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);

  function applyPresetByKey(nextKey: string) {
    setSelectedPresetKey(nextKey);

    if (nextKey === "CUSTOM") {
      return;
    }

    const preset = presets.find((entry) => entry.key === nextKey);

    if (!preset) {
      return;
    }

    const anchorDate = startTime || endTime || defaultStartTime;
    const range = applyShiftPreset(anchorDate, preset);
    setStartTime(range.startTime);
    setEndTime(range.endTime);
  }

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <FormField label="Titolo turno">
        <TextInput name="title" placeholder="Servizio pranzo" />
      </FormField>

      {presets.length > 0 ? (
        <FormField label="Orario standard">
          <Select
            value={selectedPresetKey}
            onChange={(event) => applyPresetByKey(event.target.value)}
          >
            <option value="CUSTOM">Personalizzato</option>
            {presets.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label} - {preset.startTime} / {preset.endTime}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      <div
        className="dashboard-inline-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <FormField label="Inizio">
          <TextInput
            name="startTime"
            type="datetime-local"
            required
            value={startTime}
            onChange={(event) => {
              setSelectedPresetKey("CUSTOM");
              setStartTime(event.target.value);
            }}
          />
        </FormField>

        <FormField label="Fine">
          <TextInput
            name="endTime"
            type="datetime-local"
            required
            value={endTime}
            onChange={(event) => {
              setSelectedPresetKey("CUSTOM");
              setEndTime(event.target.value);
            }}
          />
        </FormField>
      </div>

      <FormField label="Persone nel turno">
        <div className="dashboard-member-grid" style={{ display: "grid", gap: 10 }}>
          {members.map((member) => (
            <label
              key={member.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                color: "#334155",
              }}
            >
              <input type="checkbox" name="employeeIds" value={member.id} />
              {member.firstName} {member.lastName} - {formatRoleLabel(member.role)}
            </label>
          ))}
        </div>
      </FormField>

      <div className="dashboard-form-actions">
        <PrimaryButton type="submit">Salva turno</PrimaryButton>
      </div>
    </form>
  );
}
