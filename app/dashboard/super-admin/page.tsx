import { getDashboardContext } from "../context";
import { Panel } from "../ui";
import {
  SuperAdminForbidden,
  SuperAdminFrame,
  SuperAdminMenuGrid,
} from "./super-admin-ui";
import { SuperAdminOverviewLoader } from "./overview-loader";

export default async function SuperAdminPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  return (
    <SuperAdminFrame
      title="Dashboard super admin"
      description="Una regia centrale per attivita, titolari, staff associato, pagamenti e ricavo stimato."
    >
      <SuperAdminOverviewLoader />

      <Panel title="Azioni rapide">
        <SuperAdminMenuGrid />
      </Panel>
    </SuperAdminFrame>
  );
}
