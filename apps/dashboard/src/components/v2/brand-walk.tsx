"use client";

import { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GetStarted } from "@/components/v2/get-started/get-started";

/**
 * The ONE brand walk (`/get-started`'s screens), run from the dashboard on `orgId`. It
 * takes the whole screen like the signed-out walk, over the dashboard frame (portalled
 * to the v2 layer so no ancestor makes a containing block for it).
 */
export function BrandWalk({ orgId, brandId }: { orgId: string; brandId: string | null }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal") ?? document.body), []);
  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <Suspense fallback={null}>
        <GetStarted key={`${orgId}:${brandId ?? ""}`} org={{ orgId, brandId }} />
      </Suspense>
    </div>,
    host,
  );
}
