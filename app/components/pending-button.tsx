"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
  idleStyle?: CSSProperties;
  pendingStyle?: CSSProperties;
};

export function PendingButton({
  children,
  disabled,
  pendingLabel,
  style,
  idleStyle,
  pendingStyle,
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = Boolean(disabled || pending);

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending || undefined}
      style={{
        ...style,
        ...(isDisabled ? pendingStyle : idleStyle),
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
