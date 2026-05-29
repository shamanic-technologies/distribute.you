// Assembles the `variables` payload for the content-generation-service
// `expert-quote-pitch` template (proxied via api-service
// `POST /v1/content/generate-expert-quote-pitch`).
//
// The deployed template (GET /v1/content/platform-prompts?type=expert-quote-pitch,
// content-generation-service, DIS-52) declares EXACTLY three template variables:
//
//   {{brand}}            — JSON describing the expert / brand speaking
//   {{request}}          — JSON describing the journalist's request
//   {{additionalContext}} — optional free-form extra grounding
//
// Both consumers (authed HITL page + public-report draft route) MUST send these
// three keys. Sending flat keys (`spokesperson`, `opportunityText`, …) renders
// the template with empty sections → the model gets no grounding → garbage pitch.

/** Opportunity-derived context available on a ranked-queue row. */
export interface QuoteOpportunityContext {
  opportunityText: string;
  mediaOutlet?: string | null;
  journalistName?: string | null;
  deadline?: string | null;
  whyRelevant?: string | null;
  category?: string | null;
}

/** Operator-supplied brand inputs (campaign `featureInputs`). */
export interface ExpertBrandInputs {
  spokesperson?: string;
  expertiseTopics?: string;
  responseStyle?: string;
  companyContext?: string;
  valueProposition?: string;
}

/**
 * `{{request}}` — the journalist's quote request. Field names match the
 * template's documented `request` shape: question / mediaOutlet / source /
 * deadline. `source` is the reporter (journalist) name.
 */
export function buildQuoteRequestVariable(opp: QuoteOpportunityContext) {
  return {
    question: opp.opportunityText,
    mediaOutlet: opp.mediaOutlet ?? null,
    source: opp.journalistName ?? null,
    deadline: opp.deadline ?? null,
  };
}

/**
 * `{{additionalContext}}` — optional grounding the model should weigh: why this
 * opportunity was matched to the brand, and its category.
 */
export function buildAdditionalContextVariable(opp: QuoteOpportunityContext) {
  return {
    whyRelevant: opp.whyRelevant ?? null,
    category: opp.category ?? null,
  };
}

/**
 * `{{brand}}` from operator-supplied campaign `featureInputs` (authed page).
 * The public-report route derives `{{brand}}` via brand-service extract-fields
 * instead — it has no operator inputs.
 */
export function buildBrandVariableFromInputs(inputs: ExpertBrandInputs) {
  return {
    name: inputs.spokesperson ?? "",
    expertise: inputs.expertiseTopics ?? "",
    voice: inputs.responseStyle ?? "",
    companyContext: inputs.companyContext ?? "",
    valueProposition: inputs.valueProposition ?? "",
  };
}
