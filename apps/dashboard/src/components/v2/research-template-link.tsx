"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { v2Href } from "@/lib/v2/routes";

/**
 * A workflow's template chip that opens the template's Research page. It links only when Research lists that template for the crew; otherwise it stays
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
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    if (!templateKey) return;
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
  }, [templateKey, channel, step, orgId, brandId]);
  return href ? (
    <Link href={href} prefetch className="k-chip hover:text-[var(--accent)]" title="Open this template in Research">
      {label} →
    </Link>
  ) : (
    <span className="k-chip">{label}</span>
  );
}

/**
 * The model chip, same rule. The workflow names an ALIAS (`pro`, `flash`), which chat-service
 * repoints over time, so the alias is never mapped to a model here: the link follows the model
 * Research MEASURED for this workflow (the one that wrote most of its emails).
 */
export function ResearchModelChip({
  orgId,
  brandId,
  channel,
  step,
  dynasty,
  label,
}: {
  orgId: string;
  brandId: string;
  channel: string | null;
  step: string | null;
  dynasty: string;
  label: string;
}) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("@/lib/research/research")
      .then(async (r) => {
        const crew = r.researchCrewFor(channel, step);
        if (!crew) return;
        const catalog = await r.loadResearchCatalog();
        const model = r.researchWorkflow(catalog, crew, dynasty)?.model;
        if (live && model?.linked) setHref(r.researchCatalogHref(v2Href(orgId, brandId, "research"), crew, "models", model.key));
      })
      .catch((err) => console.error("[research] model link", err));
    return () => {
      live = false;
    };
  }, [dynasty, channel, step, orgId, brandId]);
  return href ? (
    <Link href={href} prefetch className="k-chip hover:text-[var(--accent)]" title="Open the model Research measured for this workflow">
      {label} →
    </Link>
  ) : (
    <span className="k-chip">{label}</span>
  );
}
