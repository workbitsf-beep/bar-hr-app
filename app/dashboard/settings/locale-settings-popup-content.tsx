"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

  function resetFeatureDraft() {
    setFeatures(savedFeatures);
  }

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

      <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
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
                      onChange={(event) =>
                        setFeatures((current) => ({
                          ...current,
                          [feature.key]: event.target.checked,
                          ...(feature.key === "tasks"
                            ? { noticeBoard: event.target.checked }
                            : {}),
                        }))
                      }
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

        <div className="dashboard-form-actions">
          <PrimaryButton type="button" tone="sand" data-popup-close onClick={resetFeatureDraft}>
            Annulla
          </PrimaryButton>
          <PrimaryButton type="submit">Salva funzioni</PrimaryButton>
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
            submitOnLocate={false}
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
                  }
                }}
              />
              Attiva arrotondamento
            </label>
            <label style={{ display: "grid", gap: 6, color: "#334155", fontWeight: 700 }}>
              Intervallo
              <select
                name="roundingMinutes"
                defaultValue={String(settings?.roundingMinutes ?? 15)}
                style={{
                  width: "100%",
                  border: "1px solid rgba(148, 163, 184, 0.28)",
                  borderRadius: 16,
                  padding: "10px 12px",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 800,
                }}
              >
                <option value="5">5 minuti</option>
                <option value="10">10 minuti</option>
                <option value="15">15 minuti</option>
                <option value="30">30 minuti</option>
              </select>
            </label>
            <input type="hidden" name="roundingMode" value="NEAREST" />
            <input
              type="hidden"
              name="roundingAcknowledged"
              value={roundingAcknowledged ? "on" : ""}
            />
            <span style={{ color: "#64748b", fontSize: 13 }}>Modalità: al più vicino</span>
          </div>
          <div className="dashboard-form-actions">
            <PrimaryButton type="button" tone="sand" data-popup-close>
              Annulla
            </PrimaryButton>
            <PrimaryButton type="submit">Salva posizione</PrimaryButton>
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
            zIndex: 1200,
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
              Workbit continuerà a salvare gli orari reali di entrata e uscita. Le ore lavorate e i report verranno invece calcolati arrotondando entrata e uscita all&apos;intervallo impostato.
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
                onClick={() => setShowRoundingInfo(false)}
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
