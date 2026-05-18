import type { ReactNode } from "react";
import { getLanguageOptions, getRoleLabel } from "@/lib/i18n";
import { getDashboardContext } from "./context";
import { logoutAction, selectBarAction, setLanguageAction } from "./actions";
import { DashboardShell, PrimaryButton, Select } from "./ui";

export default async function DashboardLayout({
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
  } = await getDashboardContext();
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
            <form className="dashboard-inline-actions" action={selectBarAction} style={{ display: "flex", gap: 8 }}>
              <Select
                name="barId"
                defaultValue={activeBarId ?? ""}
                style={{ minWidth: 220 }}
                aria-label={t.selectBar}
              >
                {accessibleBars.map((bar) => (
                  <option key={bar.id} value={bar.id}>
                    {bar.name} · {getRoleLabel(language, bar.role)}
                  </option>
                ))}
              </Select>
              <PrimaryButton type="submit" tone="sand">
                {t.changeBar}
              </PrimaryButton>
            </form>
          ) : null}

          <form className="dashboard-inline-actions" action={setLanguageAction} style={{ display: "flex", gap: 8 }}>
            <Select
              name="language"
              defaultValue={language}
              style={{ minWidth: 180 }}
              aria-label={t.language}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <PrimaryButton type="submit" tone="sand">
              {t.language}
            </PrimaryButton>
          </form>

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
