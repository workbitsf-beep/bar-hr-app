import type { ReactNode } from "react";
import { LogoutForm } from "@/app/components/logout-form";
import { SessionKeepAlive } from "@/app/components/session-keepalive";
import { EdgeSwipeNavigation } from "@/app/components/edge-swipe-navigation";
import { getLanguageOptions, getRoleLabel } from "@/lib/i18n";
import { DashboardRouteGuard } from "./dashboard-route-guard";
import { getDashboardContext } from "./context";
import { NotificationBarSync } from "./notification-bar-sync";
import { PushRegistration } from "./push-registration";
import { NativePermissions } from "./native-permissions";
import {
  logoutAction,
  returnToSuperAdminConsoleAction,
  selectBarAction,
  setLanguageAction,
} from "./actions";
import { AutoSubmitSelectForm } from "./auto-submit-select-form";
import { ConsoleShell } from "./super-admin/console-shell";
import { ConsoleMark } from "./console-mark";
import { DashboardShell } from "./ui";

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
  const userName = `${session.user.firstName} ${session.user.lastName}`;

  // The super admin console is a different product from the venue app: it gets
  // its own chrome instead of the employee/owner shell.
  if (String(role) === "SUPER_ADMIN") {
    return (
      <>
        <SessionKeepAlive />
        <NotificationBarSync activeBarId={activeBarId} />
        <PushRegistration />
        <NativePermissions />
        <ConsoleShell
          userName={userName}
          venues={accessibleBars.map((bar) => ({ id: bar.id, name: bar.name }))}
          accountPanel={
            <>
              <div className="wbc-account-id">
                <strong>{userName}</strong>
                <span>{session.user.email}</span>
              </div>

              <form action={setLanguageAction} style={{ display: "grid", gap: 9 }}>
                <span className="wbc-field-label">{t.language}</span>
                <select name="language" defaultValue={language} aria-label={t.language}>
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="wbc-btn wbc-btn-ghost wbc-btn-sm">
                  Salva lingua
                </button>
              </form>

              <LogoutForm action={logoutAction}>
                <button type="submit" className="wbc-btn wbc-btn-danger wbc-btn-block">
                  {t.logout}
                </button>
              </LogoutForm>
            </>
          }
        >
          {children}
        </ConsoleShell>
      </>
    );
  }

  return (
    <>
      <SessionKeepAlive />
      <EdgeSwipeNavigation />
      <NotificationBarSync activeBarId={activeBarId} />
      <PushRegistration />
      <NativePermissions />
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
          accessibleBars.length > 0
            ? {
                activeBarId,
                bars: accessibleBars.map((bar) => ({ id: bar.id, name: bar.name })),
              }
            : undefined
        }
        menuContent={
          <div className="workbit-menu-details" style={{ display: "grid", gap: 9 }}>
            {/* Who you are, with a face and a role. The card above it used to
                print the venue's name and then yours underneath, and when a
                venue is named after its owner - which is common - nothing
                said which of the two was which. */}
            <div
              className="workbit-menu-account-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: 13,
                borderRadius: 18,
                background: "#ffffff",
                border: "1px solid #e9e6f5",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 42,
                  height: 42,
                  flex: "0 0 auto",
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, #4c1d95, #8b5cf6)",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 850,
                }}
              >
                {`${session.user.firstName?.[0] ?? ""}${session.user.lastName?.[0] ?? ""}`.toUpperCase()}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                <strong style={{ fontSize: 15.5, fontWeight: 820, letterSpacing: "-0.018em", color: "#17161f" }}>
                  {session.user.firstName} {session.user.lastName}
                </strong>
                <span style={{ fontSize: 11.5, fontWeight: 550, color: "#a3a0b8" }}>
                  {getRoleLabel(language, role)}
                </span>
              </span>
            </div>

            {/* The venue, said once and labelled, so it cannot be mistaken for
                a person. The switcher only appears where there is something to
                switch to: with one venue it was a dropdown holding one line. */}
            {accessibleBars.length > 1 ? (
              <AutoSubmitSelectForm
                action={selectBarAction}
                name="barId"
                defaultValue={activeBarId ?? ""}
                ariaLabel={t.selectBar}
                label="Locale"
                className="workbit-menu-select-row"
                closeMenuOnChange
                options={accessibleBars.map((bar) => ({
                  value: bar.id,
                  label: bar.name,
                }))}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 1,
                  padding: "11px 13px",
                  borderRadius: 15,
                  background: "#f6f3ff",
                  border: "1px solid #ddd6fe",
                }}
              >
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 830,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#7c6bd6",
                  }}
                >
                  Locale
                </span>
                <strong style={{ fontSize: 14.5, fontWeight: 810, color: "#4c1d95" }}>
                  {activeBarName ?? t.noBarSelected}
                </strong>
              </div>
            )}
          </div>
        }
        consoleSlot={
          String(session.user.role) === "SUPER_ADMIN" ? (
            <form action={returnToSuperAdminConsoleAction} className="wb-console-form">
              <button type="submit" className="wb-console-tab" title="Torna alla console Super Admin">
                <ConsoleMark />
                <span>Console</span>
              </button>
            </form>
          ) : undefined
        }
        menuFooter={
          <LogoutForm action={logoutAction} style={{ display: "block" }}>
            <button type="submit" className="workbit-menu-logout-button">
              <span aria-hidden="true" className="workbit-menu-logout-dot" />
              <span>{t.logout}</span>
            </button>
          </LogoutForm>
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}
