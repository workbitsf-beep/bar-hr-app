"use client";

import type { CSSProperties, ReactNode } from "react";
import { clearPersistentSession } from "@/lib/client-session";

type LogoutFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  style?: CSSProperties;
};

export function LogoutForm({ action, children, style }: LogoutFormProps) {
  return (
    <form action={action} onSubmit={clearPersistentSession} style={style}>
      {children}
    </form>
  );
}
