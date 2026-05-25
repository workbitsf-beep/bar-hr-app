"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function DashboardRouteGuard({
  redirectTo,
  allowPrefixes,
}: {
  redirectTo: string | null;
  allowPrefixes?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!redirectTo) {
      return;
    }

    const isAllowed = (allowPrefixes ?? []).some((prefix) => pathname.startsWith(prefix));

    if (!isAllowed && pathname !== redirectTo) {
      router.replace(redirectTo);
    }
  }, [allowPrefixes, pathname, redirectTo, router]);

  return null;
}
