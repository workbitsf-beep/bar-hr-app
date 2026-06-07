import { getGlobalGpsRadius } from "@/lib/gps-settings";
import { getDashboardContext } from "../../context";
import { Panel } from "../../ui";
import { GlobalGpsRadiusForm } from "../global-gps-radius-form";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

export default async function SuperAdminGpsPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const globalGpsRadius = await getGlobalGpsRadius();

  return (
    <SuperAdminFrame
      title="GPS globale"
      description="Imposta il range timbrature valido per tutte le attività."
    >
      <Panel title="Range globale timbrature">
        <GlobalGpsRadiusForm initialRadius={globalGpsRadius} />
      </Panel>
    </SuperAdminFrame>
  );
}
