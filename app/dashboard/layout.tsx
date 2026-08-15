import type { ReactNode } from "react";
import { LogoutForm } from "@/app/components/logout-form";
import { SessionKeepAlive } from "@/app/components/session-keepalive";
import { ThemeSelect } from "@/app/components/theme-select";
import { getLanguageOptions, getRoleLabel } from "@/lib/i18n";
import { DashboardRouteGuard } from "./dashboard-route-guard";
import { getDashboardContext } from "./context";
import { NotificationBarSync } from "./notification-bar-sync";
import { PushRegistration } from "./push-registration";
import { logoutAction, selectBarAction, setLanguageAction } from "./actions";
import { AutoSubmitSelectForm } from "./auto-submit-select-form";
import { DashboardShell, IconButton } from "./ui";

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
    ownerNeedsSubscriptionActivation,
    navItems,
    accessibleBars,
  } = await getDashboardContext();
  const languageOptions = getLanguageOptions();

  return (
    <>
      <SessionKeepAlive />
      <NotificationBarSync activeBarId={activeBarId} />
      <PushRegistration />
      <DashboardRouteGuard
        redirectTo={ownerNeedsSubscriptionActivation ? "/dashboard/settings?billing=1" : null}
        allowPrefixes={["/dashboard/settings"]}
      />
      <DashboardShell
        userName={`${session.user.firstName} ${session.user.lastName}`}
        role={getRoleLabel(language, role)}
        barName={role === "SUPER_ADMIN" ? "Console Super Admin" : activeBarName ?? t.noBarSelected}
        appName={t.appName}
        menuLabel={t.menu}
        navItems={navItems}
        headerSwitch={
          role !== "SUPER_ADMIN"
            ? {
                activeBarId,
                bars: accessibleBars.map((bar) => ({ id: bar.id, name: bar.name })),
              }
            : undefined
        }
        menuContent={
          <div className="workbit-menu-details" style={{ display: "grid", gap: 14 }}>
            <div
              className="workbit-menu-account-card"
              style={{
                display: "grid",
                gap: 4,
                padding: 14,
                borderRadius: 18,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <strong style={{ color: "#0f172a", fontSize: 16 }}>
                {role === "SUPER_ADMIN" ? "Console Super Admin" : activeBarName ?? t.noBarSelected}
              </strong>
              <span style={{ color: "#64748b", lineHeight: 1.5 }}>
                {session.user.firstName} {session.user.lastName} - {getRoleLabel(language, role)}
              </span>
            </div>

            <span className="workbit-menu-section-label">Locale</span>

            {role !== "SUPER_ADMIN" && accessibleBars.length > 0 ? (
              <AutoSubmitSelectForm
                action={selectBarAction}
                name="barId"
                defaultValue={activeBarId ?? ""}
                ariaLabel={t.selectBar}
                label="Sede attiva"
                className="workbit-menu-select-row"
                closeMenuOnChange
                options={accessibleBars.map((bar) => ({
                  value: bar.id,
                  label: bar.name,
                }))}
              />
            ) : null}

            <AutoSubmitSelectForm
              action={setLanguageAction}
              name="language"
              defaultValue={language}
              ariaLabel={t.language}
              label={t.language}
              className="workbit-menu-select-row"
              closeMenuOnChange
              options={languageOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />

            <div className="workbit-menu-theme-row">
              <ThemeSelect defaultValue={session.user.theme ?? "SYSTEM"} />
            </div>
          </div>
        }
        headerAction={
          <LogoutForm action={logoutAction} style={{ display: "inline-flex" }}>
            <IconButton type="submit" aria-label={t.logout} title={t.logout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M10 7V5.75C10 4.78 10.78 4 11.75 4h6.5C19.22 4 20 4.78 20 5.75v12.5c0 .97-.78 1.75-1.75 1.75h-6.5A1.75 1.75 0 0 1 10 18.25V17"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 12H4m0 0 3-3m-3 3 3 3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </IconButton>
          </LogoutForm>
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}
