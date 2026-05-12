import type {
  VisibilityRun,
  VisibilityRunCitationOpportunity,
  VisibilityRunDetail,
  VisibilityRunPrompt,
  VisibilityRunTopCompetitor,
} from "./api";
import { parseDecimal } from "../components/visibility/score-card";

export interface PromptWithProvider extends VisibilityRunPrompt {
  _provider: string;
  _model: string;
}

export interface VisibilityDetailTab {
  key: string;
  label: string;
  provider: string | null;
  model: string | null;
  run: VisibilityRun;
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
    run: detail.run,
    prompts: aggregatePrompts,
    top_competitors: detail.top_competitors,
    citation_opportunities: detail.citation_opportunities,
  };

  const perProvider: VisibilityDetailTab[] = detail.by_provider.map((bp) => ({
    key: `${bp.provider}/${bp.model}`,
    label: `${bp.provider}/${bp.model}`,
    provider: bp.provider,
    model: bp.model,
    run: bp.run,
    prompts: bp.prompts.map((p) => ({ ...p, _provider: bp.provider, _model: bp.model })),
    top_competitors: bp.top_competitors,
    citation_opportunities: bp.citation_opportunities,
  }));

  return [aggregate, ...perProvider];
}

export interface RankedCompetitorRow extends VisibilityRunTopCompetitor {
  _isBrand: boolean;
}

/**
 * Merge the audited brand into the competitor table as a regular row,
 * sorted alongside competitors by share of voice (desc). Marked with
 * `_isBrand` so the UI can highlight it.
 *
 * Brand metrics are sourced from the tab's `run` (aggregate or per-provider)
 * so the row reflects the same numbers as the score cards above.
 *
 * `mention_count` for the brand row is counted from the visible prompts —
 * this matches the meaning of `mention_count` for competitors (number of
 * responses where the entity appeared). Aggregate counts across all judges.
 */
export function mergeBrandIntoCompetitors(
  competitors: VisibilityRunTopCompetitor[],
  run: VisibilityRun,
  prompts: PromptWithProvider[],
): RankedCompetitorRow[] {
  const brandShareOfVoice = parseDecimal(run.shareOfVoice) ?? 0;
  const brandAvgPosition = parseDecimal(run.avgPosition);
  const brandNetSentiment = parseDecimal(run.netSentiment) ?? 0;
  const brandMentionCount = prompts.filter((p) => p.brandFound).length;

  const brandRow: RankedCompetitorRow = {
    name: run.brandName,
    url: run.domain ? `https://${run.domain}` : null,
    mention_count: brandMentionCount,
    avg_position: brandAvgPosition,
    share_of_voice: brandShareOfVoice,
    net_sentiment: brandNetSentiment,
    _isBrand: true,
  };

  const competitorRows: RankedCompetitorRow[] = competitors.map((c) => ({
    ...c,
    _isBrand: false,
  }));

  return [brandRow, ...competitorRows].sort(
    (a, b) => b.share_of_voice - a.share_of_voice,
  );
}
