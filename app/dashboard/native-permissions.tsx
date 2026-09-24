"use client";

import { useEffect, useRef } from "react";
import { requestNativePermissionsAfterLogin } from "@/lib/native-permissions";

/**
 * Runs the permission requests once the dashboard is reached, which is the
 * first moment we know someone is signed in.
 *
 * Every navigation re-renders this, so the run is guarded: the requests belong
 * to arriving, not to each screen.
 */
export function NativePermissions() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    void requestNativePermissionsAfterLogin();
  }, []);

  return null;
}
