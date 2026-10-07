"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { BottomNavIcon, isNavItemActive } from "./bottom-nav";
import type { DashboardNavItem } from "./context";
import { CommandPalette } from "./command-palette";

/**
 * The venue app on a computer: every section in a column on the left, instead
 * of five icons at the bottom and the rest behind a menu. It is only shown
 * from 1100px up (dashboard-desktop rules in DashboardAppShellStyles); on a
 * phone, and in the installed app, nothing changes.
 *
 * It carries what the menu carried - who you are, the venue switcher, the way
 * out - so on a computer the hamburger has nothing left to do and steps aside.
 */
export function DesktopSidebar({
  navItems,
  appName,
  brandHref,
  accountContent,
  footer,
  consoleSlot,
}: {
  navItems: DashboardNavItem[];
  appName: string;
  brandHref: string;
  accountContent?: ReactNode;
  footer?: ReactNode;
  consoleSlot?: ReactNode;
}) {
  const pathname = usePathname() ?? "/dashboard";

  return (
    <aside className="wb-desk-side" aria-label="Sezioni">
      <div className="wb-desk-brand">
        <BrandLogo href={brandHref} size={30} showIcon label={appName} />
        <span>{appName}</span>
      </div>

      {accountContent ? <div className="wb-desk-account">{accountContent}</div> : null}

      <CommandPalette navItems={navItems} />

      <nav className="wb-desk-nav" data-no-runtime-translate="">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              data-on={active ? "1" : "0"}
            >
              <SidebarIcon href={item.href} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {consoleSlot}
      </nav>

      {footer ? <div className="wb-desk-foot">{footer}</div> : null}
    </aside>
  );
}

function SidebarIcon({ href }: { href: string }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (href.includes("/courses")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m3 9 9-4.5L21 9l-9 4.5L3 9Z" {...common} />
        <path d="M7 11v4.5c1.4 1.2 3 1.8 5 1.8s3.6-.6 5-1.8V11M21 9v5" {...common} />
      </svg>
    );
  }

  if (href.includes("/people")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3" {...common} />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M17.5 14.5a5 5 0 0 1 3 4.5" {...common} />
      </svg>
    );
  }

  if (href.includes("/settings")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" {...common} />
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" {...common} />
      </svg>
    );
  }

  if (href.includes("/export")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 20V10M10 20V5M15 20v-7M20 20V8" {...common} />
      </svg>
    );
  }

  return (
    <span className="wb-desk-icon">
      <BottomNavIcon href={href} />
    </span>
  );
}
