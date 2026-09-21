"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    key: "home",
    href: "/dashboard/super-admin",
    label: "Home",
    match: (path: string) => path === "/dashboard/super-admin",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10v9h12v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "locali",
    href: "/dashboard/super-admin/bars",
    label: "Locali",
    match: (path: string) => path.startsWith("/dashboard/super-admin/bars"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="4" y="10" width="16" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
        <path d="M3 10l2-6h14l2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "team",
    href: "/dashboard/super-admin/team",
    label: "Team",
    match: (path: string) =>
      path.startsWith("/dashboard/super-admin/team") ||
      path.startsWith("/dashboard/super-admin/owners") ||
      path.startsWith("/dashboard/super-admin/people"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
        <path d="M3.5 19v-.6a4.6 4.6 0 0 1 4.6-4.6h1.8a4.6 4.6 0 0 1 4.6 4.6v.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    key: "soldi",
    href: "/dashboard/super-admin/money",
    label: "Soldi",
    match: (path: string) =>
      path.startsWith("/dashboard/super-admin/money") ||
      path.startsWith("/dashboard/super-admin/billing") ||
      path.startsWith("/dashboard/super-admin/revenue"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 8v8M14.5 10c0-1-1.2-1.8-2.5-1.8S9.5 9 9.5 10s1.2 1.6 2.5 1.6 2.5.6 2.5 1.6-1.2 1.8-2.5 1.8S9.5 14.2 9.5 13.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: "altro",
    href: "/dashboard/super-admin/more",
    label: "Altro",
    match: (path: string) =>
      path.startsWith("/dashboard/super-admin/more") ||
      path.startsWith("/dashboard/super-admin/gps") ||
      path.startsWith("/dashboard/super-admin/legal") ||
      path.startsWith("/dashboard/super-admin/system") ||
      path.startsWith("/dashboard/super-admin/settings"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="1.6" fill="currentColor" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <circle cx="19" cy="12" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
] as const;

export function SuperAdminTabBar() {
  const pathname = usePathname() ?? "/dashboard/super-admin";

  return (
    <>
      <Link href="/dashboard/super-admin/new" className="sa-tabbar-fab" aria-label="Nuovo titolare e locale">
        +
      </Link>

      <nav className="sa-tabbar" aria-label="Navigazione Super Admin">
        {TABS.map((tab) => {
          const active = tab.match(pathname);

          return (
            <Link key={tab.key} href={tab.href} className={`sa-tab${active ? " sa-tab-active" : ""}`}>
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .sa-tabbar-fab {
              position: fixed;
              right: 18px;
              bottom: calc(78px + env(safe-area-inset-bottom, 0px));
              width: 52px;
              height: 52px;
              border-radius: 18px;
              background: linear-gradient(135deg, #7b2ff7, #a855f7);
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 26px;
              font-weight: 300;
              line-height: 1;
              text-decoration: none;
              box-shadow: 0 14px 28px rgba(123, 47, 247, 0.32);
              z-index: 40;
            }

            .sa-tabbar {
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 39;
              display: flex;
              background: #ffffff;
              border-top: 1px solid var(--workbit-border);
              padding: 8px 4px calc(8px + env(safe-area-inset-bottom, 0px));
            }

            .sa-tab {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4px;
              padding: 5px 0;
              text-decoration: none;
              color: #98a2b3;
            }

            .sa-tab svg {
              width: 21px;
              height: 21px;
            }

            .sa-tab span {
              font-size: 9.5px;
              font-weight: 700;
            }

            .sa-tab-active {
              color: #7b2ff7;
            }

            .sa-tabbar-spacer {
              height: 76px;
            }
          `,
        }}
      />
    </>
  );
}
