"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { GpsLocationField } from "@/app/components/gps-location-field";
import {
  featureToggleDefinitions,
  getFeatureFlags,
  type FeatureSettingsInput,
} from "@/lib/features";
import { updateSettingsAction } from "../actions";
import { PrimaryButton } from "../ui";

type LocaleSettingsPopupContentProps = {
  activityName: string;
  activityLabel: string;
  addressLabel: string;
  contactLabel: string;
  settings?: (FeatureSettingsInput & {
    gpsLatitude?: number | null;
    gpsLongitude?: number | null;
    roundingEnabled?: boolean | null;
    roundingMinutes?: number | null;
    roundingMode?: string | null;
  }) | null;
  globalGpsRadius: number;
  isRestaurant: boolean;
};

/**
 * Says what happened, where the save button used to be.
 *
 * With the change saved on its own, the only thing missing is the
 * reassurance the button used to give by being pressed.
 */
function SaveState({ idleLabel }: { idleLabel: string }) {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setJustSaved(false);
      return;
    }

    if (!wasPending.current) {
      return;
    }

    wasPending.current = false;
    setJustSaved(true);

    const id = window.setTimeout(() => setJustSaved(false), 2600);

    return () => window.clearTimeout(id);
  }, [pending]);

  return (
    <span
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 13,
        fontWeight: 700,
        color: pending ? "#64748b" : justSaved ? "#166534" : "#94a3b8",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: pending ? "#94a3b8" : justSaved ? "#16a34a" : "#cbd5e1",
        }}
      />
      {pending ? "Salvataggio…" : justSaved ? "Salvato" : idleLabel}
    </span>
  );
}

export function LocaleSettingsPopupContent({
  activityName,
  activityLabel,
  addressLabel,
  contactLabel,
  settings,
  globalGpsRadius,
  isRestaurant,
}: LocaleSettingsPopupContentProps) {
  const savedFeatures = useMemo(() => getFeatureFlags(settings), [settings]);
  const [features, setFeatures] = useState(savedFeatures);
  const trackingFormRef = useRef<HTMLFormElement>(null);
  const featuresFormRef = useRef<HTMLFormElement>(null);
  const saveTimersRef = useRef(new Map<string, number>());

  /**
   * Sends the form by itself a moment after the last change. The pause is what
   * makes flipping three switches one save instead of three.
   */
  const scheduleSave = useCallback((key: string, form: HTMLFormElement | null) => {
    if (!form) {
      return;
    }

    const timers = saveTimersRef.current;
    const previous = timers.get(key);

    if (previous) {
      window.clearTimeout(previous);
    }

    timers.set(
      key,
      window.setTimeout(() => {
        timers.delete(key);
        form.requestSubmit();
      }, 600)
    );
  }, []);

  useEffect(() => {
    const timers = saveTimersRef.current;

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, []);
  const [roundingEnabled, setRoundingEnabled] = useState(Boolean(settings?.roundingEnabled));
  const [roundingAcknowledged, setRoundingAcknowledged] = useState(Boolean(settings?.roundingEnabled));
  const [roundingConsent, setRoundingConsent] = useState(false);
  const [showRoundingInfo, setShowRoundingInfo] = useState(false);
  const visibleFeatureDefinitions = useMemo(
    () => featureToggleDefinitions.filter((feature) => isRestaurant || feature.key !== "timeTracking"),
    [isRestaurant]
  );
  const timeTrackingActive = features.timeTracking;

  useEffect(() => {
    setFeatures(savedFeatures);
    setRoundingEnabled(Boolean(settings?.roundingEnabled));
    setRoundingAcknowledged(Boolean(settings?.roundingEnabled));
    setRoundingConsent(false);
    setShowRoundingInfo(false);
  }, [savedFeatures, settings?.roundingEnabled]);

  function handleTrackingSubmit(event: FormEvent<HTMLFormElement>) {
    if (roundingEnabled && !roundingAcknowledged) {
      event.preventDefault();
      setShowRoundingInfo(true);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gap: 8,
          padding: 16,
          borderRadius: 22,
          background: "#ffffff",
          border: "1px solid rgba(124, 58, 237, 0.12)",
          color: "#334155",
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "#0f172a" }}>{activityName}</strong>
        <span>{activityLabel}</span>
        <span>{addressLabel}</span>
        <span>{contactLabel}</span>
      </div>

      <form ref={featuresFormRef} action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="settingsSection" value="features" />
        <div style={{ display: "grid", gap: 12 }}>
          <strong style={{ color: "#0f172a", fontSize: 18 }}>Scegli cosa usare</strong>
          <div
            className="dashboard-inline-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {visibleFeatureDefinitions.map((feature) => {
              const enabled = features[feature.key];

              return (
                <label
                  key={feature.key}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 18,
                    border: enabled
                      ? "1px solid rgba(124, 58, 237, 0.28)"
                      : "1px solid rgba(148, 163, 184, 0.22)",
                    background: enabled
                      ? "linear-gradient(135deg, rgba(237,233,254,0.84), rgba(255,255,255,0.96))"
                      : "#f8fafc",
                  }}
                >
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(124, 58, 237, 0.12)",
                        color: "#6d28d9",
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {feature.emoji}
                    </span>
                    <input
                      type="checkbox"
                      name={feature.field}
                      checked={enabled}
                      onChange={(event) => {
                        setFeatures((current) => ({
                          ...current,
                          [feature.key]: event.target.checked,
                          ...(feature.key === "tasks"
                            ? { noticeBoard: event.target.checked }
                            : {}),
                        }));
                        scheduleSave("features", featuresFormRef.current);
                      }}
                    />
                    <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 800, color: "#0f172a" }}>{feature.shortLabel}</span>
                      <span style={{ color: "#64748b", fontSize: 12, lineHeight: 1.35 }}>
                        {feature.description}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* No save button: the switch is the save. What is left to show is
            that it happened. */}
        <div
          className="dashboard-form-actions"
          style={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <SaveState idleLabel="Le modifiche si salvano da sole" />
          <PrimaryButton type="button" tone="sand" data-popup-close>
            Chiudi
          </PrimaryButton>
        </div>
      </form>

      {isRestaurant && timeTrackingActive ? (
        <form
          ref={trackingFormRef}
          action={updateSettingsAction}
          onSubmit={handleTrackingSubmit}
          style={{ display: "grid", gap: 16 }}
        >
          <input type="hidden" name="settingsSection" value="gps" />
          <GpsLocationField
            latitudeName="gpsLatitude"
            longitudeName="gpsLongitude"
            initialLatitude={settings?.gpsLatitude}
            initialLongitude={settings?.gpsLongitude}
            submitOnLocate
          />
          <input type="hidden" name="gpsRadius" value={String(globalGpsRadius)} />
          <div
            style={{
              display: "grid",
              gap: 10,
              padding: 14,
              borderRadius: 20,
              border: "1px solid rgba(124, 58, 237, 0.16)",
              background: "linear-gradient(135deg, rgba(245,243,255,0.9), #ffffff)",
            }}
          >
            <strong style={{ color: "#0f172a" }}>Arrotondamento ore</strong>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#0f172a" }}>
              <input
                type="checkbox"
                name="roundingEnabled"
                checked={roundingEnabled}
                onChange={(event) => {
                  setRoundingEnabled(event.target.checked);

                  if (!event.target.checked) {
                    setRoundingAcknowledged(false);
                    setRoundingConsent(false);
                    scheduleSave("gps", trackingFormRef.current);
                    return;
                  }

                  // Switching it on still goes through the warning, which is
                  // what saves it once accepted.
                  setShowRoundingInfo(true);
                }}
              />
              Attiva arrotondamento
            </label>
            <input type="hidden" name="roundingMinutes" value="15" />
            <input type="hidden" name="roundingMode" value="NEAREST" />
            <input
              type="hidden"
              name="roundingAcknowledged"
              value={roundingAcknowledged ? "on" : ""}
            />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              Regola fissa: tolleranza 5 minuti, poi scatto al quarto d&apos;ora.
            </span>
          </div>
          <div
            className="dashboard-form-actions"
            style={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <SaveState idleLabel="La posizione si salva da sola" />
            <PrimaryButton type="button" tone="sand" data-popup-close>
              Chiudi
            </PrimaryButton>
          </div>
        </form>
      ) : null}

      {showRoundingInfo ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            display: "grid",
            placeItems: "center",
            padding: 18,
            background: "rgba(15, 23, 42, 0.32)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div
            style={{
              width: "min(92vw, 420px)",
              maxHeight: "85dvh",
              overflowY: "auto",
              display: "grid",
              gap: 14,
              padding: 20,
              borderRadius: 28,
              background: "#ffffff",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.18)",
              border: "1px solid rgba(124, 58, 237, 0.14)",
            }}
          >
            <h3 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>
              Come funziona l&apos;arrotondamento?
            </h3>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.55 }}>
              Workbit continuerà a salvare gli orari reali di entrata e uscita. Le ore lavorate e i report verranno invece calcolati con tolleranza di 5 minuti e scatto al quarto d&apos;ora.
            </p>
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 14,
                borderRadius: 18,
                background: "#f8fafc",
                color: "#0f172a",
                fontWeight: 800,
              }}
            >
              <span>08:07 diventa 08:00</span>
              <span>08:08 diventa 08:15</span>
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "center", color: "#0f172a", fontWeight: 800 }}>
              <input
                type="checkbox"
                checked={roundingConsent}
                onChange={(event) => setRoundingConsent(event.target.checked)}
              />
              Ho capito come funziona
            </label>
            <div className="dashboard-form-actions">
              <PrimaryButton
                type="button"
                tone="sand"
                onClick={() => {
                  setShowRoundingInfo(false);
                  // The switch was flipped to open this: turning it back is
                  // what "cancel" means now that nothing waits for a save.
                  setRoundingEnabled(Boolean(settings?.roundingEnabled));
                  setRoundingConsent(false);
                }}
              >
                Annulla
              </PrimaryButton>
              <PrimaryButton
                type="button"
                disabled={!roundingConsent}
                onClick={() => {
                  setRoundingAcknowledged(true);
                  setShowRoundingInfo(false);
                  window.requestAnimationFrame(() => trackingFormRef.current?.requestSubmit());
                }}
              >
                Attiva arrotondamento
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
