"use client";

import { useEffect, useState } from "react";
import {
  disableWorkbitPushRegistration,
  ensureWorkbitPushRegistration,
  isWorkbitPushDisabled,
} from "@/lib/push-client";
import { EmptyState, PrimaryButton } from "../ui";

export function PushSettingsClient() {
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDisabled(isWorkbitPushDisabled());
  }, []);

  async function enablePush() {
    setLoading(true);
    setMessage(null);

    try {
      const result = await ensureWorkbitPushRegistration({ requestPermission: true });
      setDisabled(isWorkbitPushDisabled());
      setMessage(result.message);
    } finally {
      setLoading(false);
    }
  }

  async function disablePush() {
    setLoading(true);
    setMessage(null);

    try {
      const result = await disableWorkbitPushRegistration();
      setDisabled(true);
      setMessage(result.message);
    } finally {
      setLoading(false);
    }
  }

  const permission =
    typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const canDisable = permission === "granted" && !disabled;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <EmptyState
        message={
          disabled
            ? "Le notifiche push sono disattivate su questo dispositivo. Le notifiche interne restano disponibili."
            : "Puoi attivare o disattivare le notifiche push di questo dispositivo."
        }
      />
      <div className="dashboard-form-actions">
        {canDisable ? (
          <PrimaryButton type="button" tone="red" onClick={() => void disablePush()} disabled={loading}>
            {loading ? "Disattivazione..." : "Disattiva push"}
          </PrimaryButton>
        ) : (
          <PrimaryButton type="button" onClick={() => void enablePush()} disabled={loading}>
            {loading ? "Attivazione..." : "Attiva push"}
          </PrimaryButton>
        )}
        <PrimaryButton type="button" tone="sand" data-popup-close>
          Chiudi
        </PrimaryButton>
      </div>
      {message ? <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{message}</p> : null}
    </div>
  );
}
