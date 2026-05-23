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
      title="Console Super Admin"
      description="Scegli una sezione: ogni area operativa ora vive nella sua pagina dedicata."
    >
      <SuperAdminMenuGrid />
    </SuperAdminFrame>
  );
}
