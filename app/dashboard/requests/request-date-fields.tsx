"use client";

import { RequestType } from "@prisma/client";
import { SingleDayTimeRangeInput } from "@/app/components/single-day-time-range-input";
import { FormField, TextInput } from "../ui";

/**
 * The dates a request needs, for a kind that has already been chosen.
 *
 * The kind used to be the first question inside the form, a dropdown of three;
 * it is now the screen before, so what is left here is only the dates - and a
 * permesso, which is hours out of one day, asks for hours instead of two days.
 */
export function RequestDateFields({ type }: { type: RequestType }) {
  return (
    <div
      className="dashboard-inline-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      <input type="hidden" name="type" value={type} />

      {type === RequestType.PERMISSION ? (
        <div style={{ gridColumn: "1 / -1" }}>
          <SingleDayTimeRangeInput startName="startsAt" endName="endsAt" required />
        </div>
      ) : (
        <>
          <FormField label="Da">
            <TextInput type="date" name="startsAt" required />
          </FormField>

          <FormField label="A">
            <TextInput type="date" name="endsAt" required />
          </FormField>
        </>
      )}
    </div>
  );
}
