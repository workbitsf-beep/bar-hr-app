"use client";

import type { CSSProperties, ReactNode } from "react";
import { clearPersistentSession } from "@/lib/client-session";
import { clearNativeWidgets } from "@/lib/native-widgets";

type LogoutFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  style?: CSSProperties;
};

export function LogoutForm({ action, children, style }: LogoutFormProps) {
  return (
    <form
      action={action}
      onSubmit={() => {
        clearPersistentSession();
        // The next person on this phone must not see these shifts on the home screen.
        void clearNativeWidgets();
      }}
      style={style}
    >
      {children}
    </form>
  );
}
