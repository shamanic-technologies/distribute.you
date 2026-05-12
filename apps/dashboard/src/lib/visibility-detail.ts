import type {
  VisibilityRunCitationOpportunity,
  VisibilityRunDetail,
  VisibilityRunPrompt,
  VisibilityRunTopCompetitor,
} from "./api";

export interface PromptWithProvider extends VisibilityRunPrompt {
  _provider: string;
  _model: string;
}

export interface VisibilityDetailTab {
  key: string;
  label: string;
  provider: string | null;
  model: string | null;
  prompts: PromptWithProvider[];
  top_competitors: VisibilityRunTopCompetitor[];
  citation_opportunities: VisibilityRunCitationOpportunity[];
}

export function getDetailTabs(detail: VisibilityRunDetail): VisibilityDetailTab[] {
  const aggregatePrompts: PromptWithProvider[] = detail.by_provider.flatMap((bp) =>
    bp.prompts.map((p) => ({ ...p, _provider: bp.provider, _model: bp.model })),
  );

  const aggregate: VisibilityDetailTab = {
    key: "aggregate",
    label: "Aggregate",
    provider: null,
    model: null,
    prompts: aggregatePrompts,
    top_competitors: detail.top_competitors,
    citation_opportunities: detail.citation_opportunities,
  };

  const perProvider: VisibilityDetailTab[] = detail.by_provider.map((bp) => ({
    key: `${bp.provider}/${bp.model}`,
    label: `${bp.provider}/${bp.model}`,
    provider: bp.provider,
    model: bp.model,
    prompts: bp.prompts.map((p) => ({ ...p, _provider: bp.provider, _model: bp.model })),
    top_competitors: bp.top_competitors,
    citation_opportunities: bp.citation_opportunities,
  }));

  return [aggregate, ...perProvider];
}
