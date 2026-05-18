import { Role } from "@prisma/client";
import { GpsLocationField } from "@/app/components/gps-location-field";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { updateSettingsAction } from "../actions";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  Panel,
  PrimaryButton,
  Select,
  Stack,
} from "../ui";

export default async function DashboardSettingsPage() {
  const { role, activeBarId, billingStatus } = await getDashboardContext();

  if (role !== Role.OWNER) {
    return (
      <Panel title="Impostazioni">
        <EmptyState message="Solo il titolare puo modificare GPS e arrotondamento delle ore." />
      </Panel>
    );
  }

  if (!activeBarId) {
    return (
      <Panel title="Impostazioni">
        <EmptyState message="Seleziona un locale attivo per gestire le impostazioni." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const settings = await prisma.barSettings.findUnique({
    where: {
      barId: activeBarId,
    },
  });

  return (
    <>
      <Stack columns="minmax(0, 760px)">
        <Panel title="Configura locale">
          <form action={updateSettingsAction} style={{ display: "grid", gap: 16 }}>
            <GpsLocationField
              latitudeName="gpsLatitude"
              longitudeName="gpsLongitude"
              initialLatitude={settings?.gpsLatitude}
              initialLongitude={settings?.gpsLongitude}
            />

            <input type="hidden" name="gpsRadius" value="90" />

            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
              Il raggio timbrature viene impostato automaticamente a 90 metri.
            </p>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                name="roundingEnabled"
                defaultChecked={Boolean(settings?.roundingEnabled)}
              />
              Abilita arrotondamento ore
            </label>

            <div
              className="dashboard-inline-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Scatto arrotondamento">
                <Select
                  name="roundingMinutes"
                  defaultValue={String(settings?.roundingMinutes ?? 15)}
                >
                  <option value="5">5 minuti</option>
                  <option value="10">10 minuti</option>
                  <option value="15">15 minuti</option>
                </Select>
              </FormField>

              <FormField label="Modalita">
                <Select name="roundingMode" defaultValue={settings?.roundingMode ?? "NEAREST"}>
                  <option value="NEAREST">Al piu vicino</option>
                  <option value="UP">Sempre in eccesso</option>
                  <option value="DOWN">Sempre in difetto</option>
                </Select>
              </FormField>
            </div>

            <div className="dashboard-form-actions">
              <PrimaryButton type="submit">Salva impostazioni</PrimaryButton>
            </div>
          </form>
        </Panel>
      </Stack>
    </>
  );
}
