"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DashboardNavItem } from "./context";

function getBottomNavItems(navItems: DashboardNavItem[]) {
  const preferredHrefs = [
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/tasks",
    "/dashboard/documents",
    "/dashboard/timelogs",
    "/dashboard/requests",
  ];
  const preferred = preferredHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is DashboardNavItem => Boolean(item));
  const fill = navItems.filter((item) => !preferred.some((selected) => selected.href === item.href));

  return [...preferred, ...fill].slice(0, 5);
}

function BottomNavIcon({ href }: { href: string }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (href.includes("/calendar")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 9h16" {...common} />
        <path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" {...common} />
      </svg>
    );
  }

  if (href.includes("/tasks")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7h11M8 12h11M8 17h7" {...common} />
        <path d="m4 7 1 1 2-2M4 12l1 1 2-2M4 17l1 1 2-2" {...common} />
      </svg>
    );
  }

  if (href.includes("/requests")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2Z" {...common} />
        <path d="M8 9h8M8 13h5" {...common} />
      </svg>
    );
  }

  if (href === "/dashboard") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M16 19v-1.2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V19" {...common} />
        <path d="M10.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" {...common} />
      </svg>
    );
  }

  if (href.includes("/timelogs")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" {...common} />
        <path d="M12 8v4l2.5 2.5" {...common} />
      </svg>
    );
  }

  if (href.includes("/documents")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-10Z" {...common} />
        <path d="M8 12h8M8 15h5" {...common} />
      </svg>
    );
  }

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.8 14.2 9l5.6.45-4.25 3.65 1.3 5.45L12 15.65l-4.85 2.9 1.3-5.45L4.2 9.45 9.8 9 12 3.8Z" {...common} />
    </svg>
  );
}

function getBottomNavLabel(item: DashboardNavItem, index: number) {
  if (index === 4) return "Altro";
  if (item.href === "/dashboard") return "Profilo";
  if (item.href.includes("/calendar")) return item.label;
  if (item.href.includes("/tasks") || item.href.includes("/board")) return "Note";
  if (item.href.includes("/timelogs") || item.href.includes("/export")) return "Ore";
  return item.label;
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ActiveBottomNav({ navItems }: { navItems: DashboardNavItem[] }) {
  const pathname = usePathname();
  const bottomNavItems = getBottomNavItems(navItems);

  if (bottomNavItems.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Navigazione principale"
      className="dashboard-bottom-nav"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(12px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 200,
        display: "flex",
        gap: 8,
        padding: 10,
        borderRadius: 999,
        border: "1px solid var(--workbit-border)",
        background: "var(--workbit-navigation)",
        boxShadow: "var(--workbit-shadow-strong)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      {bottomNavItems.map((item, index) => {
        const active = isNavItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
            style={{
              width: 58,
              minHeight: 54,
              borderRadius: 24,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 3,
              color: active ? "#ffffff" : "var(--workbit-purple-dark)",
              background: active
                ? "linear-gradient(135deg, #20124c 0%, #7c3aed 52%, #a855f7 100%)"
                : "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
              border: active ? "1px solid rgba(255, 255, 255, 0.42)" : "1px solid var(--workbit-border)",
              boxShadow: active ? "0 14px 30px rgba(124, 58, 237, 0.28)" : "none",
              textDecoration: "none",
              transform: active ? "translateY(-3px)" : "translateY(0)",
            }}
          >
            <BottomNavIcon href={item.href} />
            <span style={{ fontSize: 10, fontWeight: 800, lineHeight: 1 }}>
              {getBottomNavLabel(item, index)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
