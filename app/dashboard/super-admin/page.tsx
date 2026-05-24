import { getDashboardContext } from "../context";
import {
  SuperAdminForbidden,
  SuperAdminFrame,
  SuperAdminMenuGrid,
} from "./super-admin-ui";

export default async function SuperAdminPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  return (
    <SuperAdminFrame
      title="Console centrale"
      description="Scegli la sezione che vuoi gestire tra responsabili, strutture, abbonamenti e GPS globale."
    >
      <SuperAdminMenuGrid />
    </SuperAdminFrame>
  );
}
