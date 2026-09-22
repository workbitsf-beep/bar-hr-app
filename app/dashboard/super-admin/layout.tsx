import type { ReactNode } from "react";
import { getDashboardContext } from "../context";
import { SuperAdminFab } from "./super-admin-tabbar";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <SuperAdminFab />
    </>
  );
}
