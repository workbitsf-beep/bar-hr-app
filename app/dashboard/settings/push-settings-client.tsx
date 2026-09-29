"use client";

import { useEffect, useState } from "react";
import {
  disableWorkbitPushRegistration,
  ensureWorkbitPushRegistration,
  isWorkbitPushDisabled,
} from "@/lib/push-client";
import { PrimaryButton } from "../ui";

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

  /**
   * One switch, because one switch is all there is: the phone either takes
   * Workbit's notifications or it does not. Choosing them by kind - shifts
   * yes, courses no - would need somewhere to keep that choice and something
   * to read it when a notification is sent, and neither exists yet.
   */
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "12px 13px",
          borderRadius: 16,
          border: "1px solid #e9e6f5",
          background: "#ffffff",
          cursor: loading ? "default" : "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            flex: "0 0 auto",
            borderRadius: 999,
            background: "#a855f7",
            opacity: canDisable ? 1 : 0.4,
          }}
        />
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
          <strong style={{ fontSize: 14, fontWeight: 760, color: "#17161f" }}>
            Notifiche su questo telefono
          </strong>
          <span style={{ fontSize: 11.5, fontWeight: 520, color: "#a3a0b8", lineHeight: 1.4 }}>
            {permission === "unsupported"
              ? "Questo apparecchio non le supporta"
              : canDisable
                ? "Turni, timbrature, richieste e note"
                : "Spente: le vedi solo aprendo l\u2019app"}
          </span>
        </span>
        <input
          type="checkbox"
          checked={canDisable}
          disabled={loading || permission === "unsupported"}
          onChange={(event) => {
            if (event.target.checked) {
              void enablePush();
              return;
            }

            void disablePush();
          }}
          style={{ width: 20, height: 20, flex: "0 0 auto", accentColor: "#5e4ae3" }}
        />
      </label>

      {message ? (
        <p
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 13,
            background: "#f2f0fa",
            color: "#6b6880",
            fontSize: 12.5,
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {message}
        </p>
      ) : null}

      <div className="dashboard-form-actions">
        <PrimaryButton type="button" tone="sand" data-popup-close>
          Chiudi
        </PrimaryButton>
      </div>
    </div>
  );
}
