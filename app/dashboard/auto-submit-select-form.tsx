"use client";

import { useRef } from "react";
import { Select } from "./ui";

type OptionItem = {
  value: string;
  label: string;
};

export function AutoSubmitSelectForm({
  action,
  name,
  defaultValue,
  ariaLabel,
  options,
  minWidth,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  defaultValue: string;
  ariaLabel: string;
  options: OptionItem[];
  minWidth?: number;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form
      ref={formRef}
      className="dashboard-inline-actions"
      action={action}
      style={{ display: "flex", gap: 8 }}
    >
      <Select
        name={name}
        defaultValue={defaultValue}
        style={minWidth ? { minWidth } : undefined}
        aria-label={ariaLabel}
        onChange={(event) => {
          event.currentTarget.form?.requestSubmit();
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
