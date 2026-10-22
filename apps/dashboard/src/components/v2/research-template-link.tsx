"use client";

import { CatalogueName } from "@/components/v2/catalogue-name";
import { v2Href } from "@/lib/v2/routes";
import { researchCatalogHref, researchPipeFor, researchTemplateOf, researchWorkflow } from "@/lib/research/research";
import { useResearchCatalog } from "@/lib/research/research-source";

/**
 * A workflow's template chip that opens the template's Research page. It links only when Research lists that template for the pipe; otherwise it stays
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
  version = null,
}: {
  orgId: string;
  brandId: string;
  channel: string | null;
  step: string | null;
  templateKey: string | null;
  label: string;
  version?: string | null;
}) {
  const { data: catalog } = useResearchCatalog("user");
  const pipe = researchPipeFor(channel, step);
  // A workflow names the template VERSION it writes with; Research lists it under its dynasty's page.
  const row = catalog && pipe && templateKey ? researchTemplateOf(catalog, pipe, templateKey) : null;
  const href = row && pipe ? researchCatalogHref(v2Href(orgId, brandId, "research"), pipe, "templates", row.key) : null;
  return <CatalogueName kind="template" variant="chip" name={label} version={version} href={href} />;
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
  const pipe = researchPipeFor(channel, step);
  const model = catalog && pipe ? researchWorkflow(catalog, pipe, dynasty)?.model : null;
  const href = model?.linked ? researchCatalogHref(v2Href(orgId, brandId, "research"), pipe!, "models", model.key) : null;
  return <CatalogueName kind="llm" variant="chip" name={label} href={href} />;
}
