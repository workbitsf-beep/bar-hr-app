"use client";

import { useMemo, useState } from "react";
import { FormField, PrimaryButton, Select, TextArea } from "../ui";

type ShiftOption = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
};

type TeammateOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type TeammateShiftOption = ShiftOption & {
  userId: string;
  userName: string;
};

function formatShiftLabel(shift: ShiftOption) {
  const startsAt = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(shift.startTime));
  const endsAt = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(shift.endTime));

  return `${shift.title || "Turno"} - ${startsAt}-${endsAt}`;
}

export function ShiftChangeForm({
  action,
  ownShifts,
  teammates,
  teammateShifts,
}: {
  action: (formData: FormData) => void | Promise<void>;
  ownShifts: ShiftOption[];
  teammates: TeammateOption[];
  teammateShifts: TeammateShiftOption[];
}) {
  const [selectedTeammateId, setSelectedTeammateId] = useState("");
  const availableTeammateShifts = useMemo(
    () => teammateShifts.filter((shift) => shift.userId === selectedTeammateId),
    [selectedTeammateId, teammateShifts]
  );

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      <FormField label="Il tuo turno">
        <Select name="shiftId" required defaultValue="">
          <option value="" disabled>
            Seleziona il tuo turno
          </option>
          {ownShifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {formatShiftLabel(shift)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Collega">
        <Select
          name="swapWithUserId"
          required
          value={selectedTeammateId}
          onChange={(event) => setSelectedTeammateId(event.target.value)}
        >
          <option value="" disabled>
            Seleziona un collega
          </option>
          {teammates.map((teammate) => (
            <option key={teammate.id} value={teammate.id}>
              {teammate.firstName} {teammate.lastName}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Turno del collega">
        <Select name="swapShiftId" required defaultValue="" disabled={!selectedTeammateId}>
          <option value="" disabled>
            {selectedTeammateId ? "Seleziona il turno esistente" : "Seleziona prima il collega"}
          </option>
          {availableTeammateShifts.map((shift) => (
            <option key={`${shift.userId}-${shift.id}`} value={shift.id}>
              {formatShiftLabel(shift)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Motivo">
        <TextArea name="reason" placeholder="Spiega il motivo del cambio turno" />
      </FormField>

      <input type="hidden" name="notifySuccess" value="1" />

      <div className="dashboard-form-actions">
        <PrimaryButton type="submit">Invia cambio turno</PrimaryButton>
      </div>
    </form>
  );
}
