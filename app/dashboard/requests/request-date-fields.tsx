"use client";

import { RequestType } from "@prisma/client";
import { useState } from "react";
import { DateTimeInput } from "@/app/components/date-time-input";
import { SingleDayTimeRangeInput } from "@/app/components/single-day-time-range-input";
import { FormField, Select } from "../ui";

export function RequestDateFields() {
  const [type, setType] = useState<string>(RequestType.VACATION);

  return (
    <div
      className="dashboard-inline-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      <FormField label="Tipo">
        <Select name="type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value={RequestType.VACATION}>Ferie</option>
          <option value={RequestType.PERMISSION}>Permesso</option>
          <option value={RequestType.SICKNESS}>Malattia</option>
        </Select>
      </FormField>

      {type === RequestType.PERMISSION ? (
        <div style={{ gridColumn: "1 / -1" }}>
          <SingleDayTimeRangeInput startName="startsAt" endName="endsAt" required />
        </div>
      ) : (
        <>
          <FormField label="Da">
            <DateTimeInput name="startsAt" required />
          </FormField>

          <FormField label="A">
            <DateTimeInput name="endsAt" required />
          </FormField>
        </>
      )}
    </div>
  );
}
