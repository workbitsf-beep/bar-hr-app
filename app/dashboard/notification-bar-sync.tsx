"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function NotificationBarSync({ activeBarId }: { activeBarId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const switchingRef = useRef<string | null>(null);

  useEffect(() => {
    const targetBarId = searchParams.get("barId");
    const hasLegacyClockAction = searchParams.has("clockAction");

    if (!targetBarId) {
      if (hasLegacyClockAction) {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("clockAction");
        const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
        router.replace(nextUrl, { scroll: false });
      }
      return;
    }

    if (targetBarId === activeBarId) {
      switchingRef.current = null;

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("barId");
      nextParams.delete("clockAction");
      const nextUrl = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });

      return;
    }

    if (switchingRef.current === targetBarId) {
      return;
    }

    switchingRef.current = targetBarId;

    async function switchBar() {
      const response = await fetch("/api/bars/select", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ barId: targetBarId }),
      });

      if (!response.ok) {
        switchingRef.current = null;
        return;
      }

      router.refresh();
    }

    void switchBar();
  }, [activeBarId, pathname, router, searchParams]);

  return null;
}
