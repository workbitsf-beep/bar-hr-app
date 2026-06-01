import { getDashboardContext } from "../context";
import { SuperAdminForbidden, SuperAdminFrame } from "./super-admin-ui";
import { SuperAdminHomeHub } from "./home-hub";

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getDashboardContext();
  const params = searchParams ? await searchParams : {};

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  return (
    <SuperAdminFrame
      title="Hub super admin"
      description="Vista leggera per creare titolari, aprire attività, cercare bar e utenti e gestire gli abbonamenti."
    >
      <SuperAdminHomeHub searchParams={params} />
    </SuperAdminFrame>
  );
}
