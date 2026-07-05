import { Role } from "@prisma/client";
import { getDashboardContext } from "../../context";
import { PasswordChangePanel } from "../../settings/password-change-panel";
import { Panel, Stack } from "../../ui";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

export default async function SuperAdminSettingsPage() {
  const { role } = await getDashboardContext();

  if (role !== Role.SUPER_ADMIN) {
    return <SuperAdminForbidden />;
  }

  return (
    <SuperAdminFrame
      title="Impostazioni"
      description="Gestione account Super Admin e sicurezza."
    >
      <Stack columns="minmax(0, 1fr)">
        <PasswordChangePanel />
        <Panel title="Account interno">
          <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
            Area riservata al Super Admin. Le impostazioni operative dei clienti restano nelle
            rispettive attività.
          </p>
        </Panel>
      </Stack>
    </SuperAdminFrame>
  );
}
