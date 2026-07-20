"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function WorkbitRouteTransition() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    setActive(true);

    const timeout = window.setTimeout(() => setActive(false), 520);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={`workbit-route-transition${active ? " workbit-route-transition--active" : ""}`}
    />
  );
}
