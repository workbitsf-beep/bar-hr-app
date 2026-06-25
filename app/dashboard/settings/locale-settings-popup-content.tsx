"use client";

import { useState } from "react";
import { GpsLocationField } from "@/app/components/gps-location-field";
import {
  featureDefinitions,
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
  const [features, setFeatures] = useState(() => getFeatureFlags(settings));
  const timeTrackingActive = features.timeTracking;

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
          <strong style={{ color: "#0f172a", fontSize: 18 }}>Funzioni attive</strong>
          <div
            className="dashboard-inline-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {featureDefinitions.map((feature) => {
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
          <PrimaryButton type="button" tone="sand" data-popup-close>
            Annulla
          </PrimaryButton>
          <PrimaryButton type="submit">Salva funzioni</PrimaryButton>
        </div>
      </form>

      {isRestaurant && timeTrackingActive ? (
        <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
          <input type="hidden" name="settingsSection" value="gps" />
          <GpsLocationField
            latitudeName="gpsLatitude"
            longitudeName="gpsLongitude"
            initialLatitude={settings?.gpsLatitude}
            initialLongitude={settings?.gpsLongitude}
            submitOnLocate={false}
          />
          <input type="hidden" name="gpsRadius" value={String(globalGpsRadius)} />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#0f172a" }}>
            <input type="checkbox" name="roundingEnabled" defaultChecked={Boolean(settings?.roundingEnabled)} />
            Arrotondamento attivo
          </label>
          <input type="hidden" name="roundingMinutes" value="15" />
          <input type="hidden" name="roundingMode" value="NEAREST" />
          <div className="dashboard-form-actions">
            <PrimaryButton type="button" tone="sand" data-popup-close>
              Annulla
            </PrimaryButton>
            <PrimaryButton type="submit">Salva posizione</PrimaryButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
