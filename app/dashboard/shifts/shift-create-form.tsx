"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { combineDateAndTime, toDateInputValue } from "@/lib/shift-datetime";
import type { ShiftPreset } from "@/lib/shift-presets";
import { TimeInput } from "@/app/components/time-input";
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const defaultShiftDate = useMemo(() => toDateInputValue(new Date()), []);
  const [selectedPresetKey, setSelectedPresetKey] = useState("CUSTOM");
  const [shiftDate, setShiftDate] = useState(defaultShiftDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isOnCall, setIsOnCall] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    message: string;
  } | null>(null);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setFeedback(null);

    startTransition(async () => {
      try {
        await action(formData);
        setFeedback({ tone: "success", message: "Turno salvato." });
        formElement.reset();
        setSelectedPresetKey("CUSTOM");
        setShiftDate(defaultShiftDate);
        setStartTime("");
        setEndTime("");
        setIsOnCall(false);
        router.refresh();
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      <input type="hidden" name="startTime" value={combineDateAndTime(shiftDate, startTime)} />
      <input type="hidden" name="endTime" value={combineDateAndTime(shiftDate, endTime)} />

      {feedback ? (
        <div
          style={{
            borderRadius: 18,
            padding: "12px 14px",
            background: feedback.tone === "danger" ? "#fee2e2" : "#dcfce7",
            color: feedback.tone === "danger" ? "#991b1b" : "#166534",
            lineHeight: 1.6,
          }}
        >
          {feedback.message}
        </div>
      ) : null}

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
          <TimeInput
            required
            value={startTime}
            onChange={(nextValue) => {
              setSelectedPresetKey("CUSTOM");
              setStartTime(nextValue);
            }}
          />
        </FormField>

        <FormField label="Orario di fine">
          <TimeInput
            required
            value={endTime}
            onChange={(nextValue) => {
              setSelectedPresetKey("CUSTOM");
              setEndTime(nextValue);
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
              <input type="checkbox" name="employeeIds" value={member.id} disabled={isPending} />
              {member.firstName} {member.lastName} - {formatRoleLabel(member.role)}
            </label>
          ))}
        </div>
      </FormField>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#334155",
          fontWeight: 600,
        }}
      >
        <input
          type="checkbox"
          name="isOnCall"
          checked={isOnCall}
          onChange={(event) => setIsOnCall(event.target.checked)}
          disabled={isPending}
        />
        Reperibilita
      </label>

      <div className="dashboard-form-actions">
        <PrimaryButton type="submit" disabled={isPending}>
          {isPending ? "Salvataggio..." : "Salva turno"}
        </PrimaryButton>
      </div>
    </form>
  );
}
