"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/dashboard/super-admin", label: "Rete" },
  { href: "/dashboard/super-admin/money", label: "Denaro" },
  { href: "/dashboard/super-admin/people", label: "Persone" },
  { href: "/dashboard/super-admin/system", label: "Sistema" },
];

const ROOT = "/dashboard/super-admin";

// Pages that live under their own path but belong to a section's territory.
const ANNEXES: Record<string, string[]> = {
  [ROOT]: [`${ROOT}/bar/`, `${ROOT}/new`],
  [`${ROOT}/system`]: [`${ROOT}/legal`, `${ROOT}/settings`, `${ROOT}/usage`],
};

function isActive(pathname: string, href: string) {
  if (href === ROOT ? pathname === ROOT : pathname === href || pathname.startsWith(`${href}/`)) {
    return true;
  }

  return (ANNEXES[href] ?? []).some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function ConsoleRail() {
  const pathname = usePathname() ?? ROOT;

  return (
    <nav className="wbc-rail" aria-label="Sezioni console">
      {SECTIONS.map((section) => {
        const active = isActive(pathname, section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            data-on={active ? "1" : "0"}
            aria-current={active ? "page" : undefined}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
