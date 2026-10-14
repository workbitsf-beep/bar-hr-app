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

    // Inside the installed app the card is never asked (see context.ts): the
    // first page, before the app's cookie is set, must not ask either.
    if (document.documentElement.getAttribute("data-native") === "1") {
      return;
    }

    const isAllowed = (allowPrefixes ?? []).some((prefix) => pathname.startsWith(prefix));

    if (!isAllowed && pathname !== redirectTo) {
      router.replace(redirectTo);
    }
  }, [allowPrefixes, pathname, redirectTo, router]);

  return null;
}
