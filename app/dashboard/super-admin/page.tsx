import { getDashboardContext } from "../context";
import { SuperAdminForbidden, SuperAdminFrame } from "./super-admin-ui";
import { SuperAdminHomeHub } from "./home-hub";

export default async function SuperAdminPage() {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  return (
    <SuperAdminFrame
      title="Tutto sotto controllo."
      description="Accessi rapidi e riepilogo essenziale di attività, titolari e abbonamenti."
    >
      <SuperAdminHomeHub />
    </SuperAdminFrame>
  );
}
