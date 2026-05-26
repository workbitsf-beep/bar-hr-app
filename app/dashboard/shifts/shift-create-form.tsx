"use client";

import { useMemo, useState } from "react";
import { combineDateAndTime, toDateInputValue } from "@/lib/shift-datetime";
import type { ShiftPreset } from "@/lib/shift-presets";
import { FormField, PrimaryButton, Select, TextInput } from "../ui";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

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
  const defaultShiftDate = useMemo(() => toDateInputValue(new Date()), []);
  const [selectedPresetKey, setSelectedPresetKey] = useState("CUSTOM");
  const [shiftDate, setShiftDate] = useState(defaultShiftDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  function applyPresetByKey(nextKey: string) {
    setSelectedPresetKey(nextKey);

    if (nextKey === "CUSTOM") {
      return;
    }

    const preset = presets.find((entry) => entry.key === nextKey);

    if (!preset) {
      return;
    }

    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
  }

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <input type="hidden" name="startTime" value={combineDateAndTime(shiftDate, startTime)} />
      <input type="hidden" name="endTime" value={combineDateAndTime(shiftDate, endTime)} />

      <FormField label="Titolo turno">
        <TextInput name="title" placeholder="Servizio pranzo" />
      </FormField>

      <FormField label="Giorno">
        <TextInput
          type="date"
          required
          value={shiftDate}
          onChange={(event) => setShiftDate(event.target.value)}
        />
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
        <FormField label="Orario di inizio">
          <TextInput
            type="time"
            required
            value={startTime}
            onChange={(event) => {
              setSelectedPresetKey("CUSTOM");
              setStartTime(event.target.value);
            }}
          />
        </FormField>

        <FormField label="Orario di fine">
          <TextInput
            type="time"
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
