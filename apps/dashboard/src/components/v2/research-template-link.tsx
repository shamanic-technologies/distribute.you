"use client";

import { CatalogueName } from "@/components/v2/catalogue-name";
import { v2Href } from "@/lib/v2/routes";
import { firstMeasureListing, researchCatalogHref, researchScript, researchTemplateOf } from "@/lib/research/research";
import { useResearchCatalog } from "@/lib/research/research-source";

/**
 * A workflow's template chip that opens the template's Research page: the first Engine measure (served order) whose
 * catalogue lists that template. It links only when Research lists it; otherwise it stays the plain chip it was. The
 * catalogue comes from the staff-only Research route (a non-staff reader gets a 403 and the plain chip), shared with
 * the Research page's own cache.
 */
export function ResearchTemplateChip({
  orgId,
  brandId,
  templateKey,
  label,
  version = null,
}: {
  orgId: string;
  brandId: string;
  templateKey: string | null;
  label: string;
  version?: string | null;
}) {
  const { data: catalog } = useResearchCatalog("user");
  // A workflow names the template VERSION it writes with; Research lists it under its dynasty's page.
  const measure = catalog && templateKey ? firstMeasureListing(catalog, (m) => m.templates.some((t) => t.key === templateKey || (t.versions ?? []).some((v) => v.key === templateKey))) : null;
  const row = catalog && measure && templateKey ? researchTemplateOf(catalog, measure, templateKey) : null;
  const href = row && measure ? researchCatalogHref(v2Href(orgId, brandId, "research"), measure, "templates", row.key) : null;
  return <CatalogueName kind="template" variant="chip" name={label} version={version} href={href} servedKey={templateKey} />;
}

/**
 * The model chip, same rule. The workflow names an ALIAS (`pro`, `flash`), which chat-service
 * repoints over time, so the alias is never mapped to a model here: the link follows the model
 * Research MEASURED for this workflow as a script (the one that wrote most of its emails), on the first measure listing it.
 */
export function ResearchModelChip({
  orgId,
  brandId,
  dynasty,
  label,
}: {
  orgId: string;
  brandId: string;
  dynasty: string;
  label: string;
}) {
  const { data: catalog } = useResearchCatalog("user");
  const measure = catalog ? firstMeasureListing(catalog, (m) => m.scripts.some((w) => w.key === dynasty)) : null;
  const model = catalog && measure ? researchScript(catalog, measure, dynasty)?.model : null;
  const href = model?.linked && measure ? researchCatalogHref(v2Href(orgId, brandId, "research"), measure, "llms", model.key) : null;
  return <CatalogueName kind="llm" variant="chip" name={label} href={href} />;
}
