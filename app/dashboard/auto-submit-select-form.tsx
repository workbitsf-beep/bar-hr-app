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
  label,
  className,
  closeMenuOnChange = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  defaultValue: string;
  ariaLabel: string;
  options: OptionItem[];
  minWidth?: number;
  label?: string;
  className?: string;
  closeMenuOnChange?: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form
      ref={formRef}
      className={["dashboard-inline-actions", className].filter(Boolean).join(" ")}
      action={action}
      data-dashboard-menu-close={closeMenuOnChange ? "true" : undefined}
      style={{ display: "grid", gap: 8 }}
    >
      {label ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          {label}
        </span>
      ) : null}
      <Select
        name={name}
        defaultValue={defaultValue}
        style={minWidth ? { minWidth } : undefined}
        aria-label={ariaLabel}
        onChange={(event) => {
          const form = event.currentTarget.form ?? formRef.current;

          if (typeof form?.requestSubmit === "function") {
            form.requestSubmit();
            return;
          }

          form?.submit();
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
