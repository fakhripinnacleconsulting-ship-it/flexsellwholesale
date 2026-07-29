"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendGTMEvent } from "@/lib/gtm";

export function GTMRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (pathname) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      sendGTMEvent({
        event: "page_view",
        page_location: window.location.href,
        page_path: url,
        page_title: document.title,
      });
    }
  }, [pathname, searchParams]);

  return null;
}
