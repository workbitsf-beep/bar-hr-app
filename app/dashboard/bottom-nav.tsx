"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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

  if (href === "/dashboard/super-admin") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...common} />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...common} />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...common} />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/owners")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15.5 19v-1.1a4.2 4.2 0 0 0-4.2-4.2H8a4.2 4.2 0 0 0-4.2 4.2V19" {...common} />
        <circle cx="9.6" cy="7.5" r="3.3" {...common} />
        <path d="M17 8h4M19 6v4" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/bars")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10h16v10H4V10Z" {...common} />
        <path d="m3 10 2-6h14l2 6M8 20v-6h4v6M16 14h1.5" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/billing")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" {...common} />
        <path d="M3 10h18M7 15h4" {...common} />
      </svg>
    );
  }

  if (href.includes("/super-admin/gps")) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" {...common} />
        <circle cx="12" cy="10" r="2.2" {...common} />
      </svg>
    );
  }

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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("workbit:dashboard-route-change", {
        detail: { pathname },
      })
    );

    if (!pathname.startsWith("/dashboard/calendar")) {
      window.dispatchEvent(new CustomEvent("workbit:calendar-cleanup"));
      document
        .querySelectorAll<HTMLElement>(".dashboard-week-strip, .dashboard-calendar-scroll")
        .forEach((element) => {
          element.scrollLeft = 0;
        });
    }
  }, [pathname]);

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
        gap: 6,
        padding: "12px 10px",
        borderRadius: 30,
        border: "1px solid rgba(60, 60, 67, 0.12)",
        background: "rgba(255, 255, 255, 0.88)",
        boxShadow: "0 10px 24px rgba(61, 42, 153, 0.14)",
        backdropFilter: "blur(22px) saturate(140%)",
        WebkitBackdropFilter: "blur(22px) saturate(140%)",
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
              minHeight: 58,
              borderRadius: 22,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 5,
              color: active ? "var(--workbit-purple-dark)" : "rgba(61, 42, 153, 0.78)",
              background: active
                ? "linear-gradient(180deg, #ffffff 0%, #f1edff 100%)"
                : "transparent",
              border: active ? "1px solid rgba(94, 92, 230, 0.22)" : "1px solid transparent",
              boxShadow: active
                ? "0 0 0 6px rgba(94, 92, 230, 0.08), 0 8px 18px rgba(61, 42, 153, 0.14)"
                : "none",
              textDecoration: "none",
              transform: "translateY(0)",
            }}
          >
            <BottomNavIcon href={item.href} />
            <span style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1 }}>
              {getBottomNavLabel(item, index)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
