import { Suspense } from "react";
import { getDashboardContext } from "../context";
import {
  SuperAdminForbidden,
  SuperAdminFrame,
} from "./super-admin-ui";
import { OverviewSkeleton, SuperAdminOverviewLoader } from "./overview-loader";

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
      <Suspense fallback={<OverviewSkeleton />}>
        <SuperAdminOverviewLoader />
      </Suspense>
    </SuperAdminFrame>
  );
}
