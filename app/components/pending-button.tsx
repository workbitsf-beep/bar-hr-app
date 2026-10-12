"use client";

import { useContext, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ActionFormPending } from "./action-form";

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
  const status = useFormStatus();
  // Busy too inside an ActionForm, which submits on its own.
  const actionFormPending = useContext(ActionFormPending);
  const pending = status.pending || actionFormPending;
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
