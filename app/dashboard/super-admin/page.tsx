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
      title="Super Admin"
      description="Clienti, ricavi e abbonamenti in una control room veloce, pulita e leggibile."
    >
      <SuperAdminHomeHub />
    </SuperAdminFrame>
  );
}
