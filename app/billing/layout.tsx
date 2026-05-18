import type { ReactNode } from "react";
import { getLanguageOptions, getRoleLabel } from "@/lib/i18n";
import { getDashboardContext } from "@/app/dashboard/context";
import {
  logoutAction,
  selectBarAction,
  setLanguageAction,
} from "@/app/dashboard/actions";
import { AutoSubmitSelectForm } from "@/app/dashboard/auto-submit-select-form";
import { DashboardShell, PrimaryButton } from "@/app/dashboard/ui";

export default async function BillingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const {
    session,
    role,
    language,
    t,
    activeBarId,
    activeBarName,
    navItems,
    accessibleBars,
  } = await getDashboardContext({ allowBillingDestination: true });
  const languageOptions = getLanguageOptions();

  return (
    <DashboardShell
      userName={`${session.user.firstName} ${session.user.lastName}`}
      role={getRoleLabel(language, role)}
      barName={role === "SUPER_ADMIN" ? "Console Super Admin" : activeBarName ?? t.noBarSelected}
      appName={t.appName}
      menuLabel={t.menu}
      navItems={navItems}
      toolbar={
        <div
          className="dashboard-toolbar"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {role !== "SUPER_ADMIN" && accessibleBars.length > 0 ? (
            <AutoSubmitSelectForm
              action={selectBarAction}
              name="barId"
              defaultValue={activeBarId ?? ""}
              ariaLabel={t.selectBar}
              minWidth={220}
              options={accessibleBars.map((bar) => ({
                value: bar.id,
                label: `${bar.name} - ${getRoleLabel(language, bar.role)}`,
              }))}
            />
          ) : null}

          <AutoSubmitSelectForm
            action={setLanguageAction}
            name="language"
            defaultValue={language}
            ariaLabel={t.language}
            minWidth={180}
            options={languageOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />

          <form className="dashboard-inline-actions" action={logoutAction}>
            <PrimaryButton type="submit">{t.logout}</PrimaryButton>
          </form>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
