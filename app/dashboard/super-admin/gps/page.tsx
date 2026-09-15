import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { getDashboardContext } from "../../context";
import { Panel } from "../../ui";
import { GlobalGpsRadiusForm } from "../global-gps-radius-form";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

export default async function SuperAdminGlobalSettingsPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const globalGpsRadius = await getGlobalGpsRadius();

  return (
    <SuperAdminFrame
      title="GPS globale"
      description="Controllo del range timbrature globale."
      section="gps"
    >
      <Panel title="Range globale timbrature">
        <GlobalGpsRadiusForm initialRadius={globalGpsRadius} />
      </Panel>
    </SuperAdminFrame>
  );
}
