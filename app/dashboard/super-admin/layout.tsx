import type { ReactNode } from "react";
import { getDashboardContext } from "../context";
import { SuperAdminTabBar } from "./super-admin-tabbar";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div className="sa-tabbar-spacer" aria-hidden="true" />
      <SuperAdminTabBar />
    </>
  );
}
