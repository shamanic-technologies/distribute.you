"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIsAdminUser } from "@/lib/use-admin-user";
import { v2Href } from "@/lib/v2/routes";

/**
 * A workflow's template chip that opens the template's Research page, for staff (Research is
 * staff-only). It links only when Research lists that template for the crew; otherwise it stays
 * the plain chip it was. The research module is imported on demand, so the workflow page does not
 * carry the research snapshot in its own bundle.
 */
export function ResearchTemplateChip({
  orgId,
  brandId,
  channel,
  step,
  templateKey,
  label,
}: {
  orgId: string;
  brandId: string;
  channel: string | null;
  step: string | null;
  templateKey: string | null;
  label: string;
}) {
  const staff = useIsAdminUser();
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    if (!staff || !templateKey) return;
    let live = true;
    import("@/lib/research/research")
      .then(async (r) => {
        const crew = r.researchCrewFor(channel, step);
        if (!crew) return;
        const catalog = await r.loadResearchCatalog();
        if (live && r.researchTemplate(catalog, crew, templateKey)) {
          setHref(r.researchCatalogHref(v2Href(orgId, brandId, "research"), crew, "templates", templateKey));
        }
      })
      .catch((err) => console.error("[research] template link", err));
    return () => {
      live = false;
    };
  }, [staff, templateKey, channel, step, orgId, brandId]);
  return href ? (
    <Link href={href} prefetch className="k-chip hover:text-[var(--accent)]" title="Open this template in Research">
      {label} →
    </Link>
  ) : (
    <span className="k-chip">{label}</span>
  );
}
