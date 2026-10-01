"use client";

import Link from "next/link";
import { v2Href } from "@/lib/v2/routes";
import { researchCatalogHref, researchCrewFor, researchTemplate, researchWorkflow } from "@/lib/research/research";
import { useResearchCatalog } from "@/lib/research/research-source";

/**
 * A workflow's template chip that opens the template's Research page. It links only when Research lists that template for the crew; otherwise it stays
 * the plain chip it was. The catalogue comes from the staff-only Research route (a non-staff
 * reader gets a 403 and the plain chip), shared with the Research page's own cache.
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
  const { data: catalog } = useResearchCatalog("user");
  const crew = researchCrewFor(channel, step);
  const href =
    catalog && crew && templateKey && researchTemplate(catalog, crew, templateKey)
      ? researchCatalogHref(v2Href(orgId, brandId, "research"), crew, "templates", templateKey)
      : null;
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
  const { data: catalog } = useResearchCatalog("user");
  const crew = researchCrewFor(channel, step);
  const model = catalog && crew ? researchWorkflow(catalog, crew, dynasty)?.model : null;
  const href = model?.linked ? researchCatalogHref(v2Href(orgId, brandId, "research"), crew!, "models", model.key) : null;
  return href ? (
    <Link href={href} prefetch className="k-chip hover:text-[var(--accent)]" title="Open the model Research measured for this workflow">
      {label} →
    </Link>
  ) : (
    <span className="k-chip">{label}</span>
  );
}
