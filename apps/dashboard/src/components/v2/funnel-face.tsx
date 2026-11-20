"use client";

import { funnelCampaignFaceSrc } from "@/lib/sales-funnel-campaigns";

/** The campaign's face, drawn by features-service from its name. */
export function FunnelFace({ name, size }: { name: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={funnelCampaignFaceSrc(name)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-[var(--bg-inset)] shadow-[inset_0_0_0_1px_var(--line)]"
      style={{ width: size, height: size }}
    />
  );
}
