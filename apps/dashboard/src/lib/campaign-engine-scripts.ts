import { z } from "zod";

/**
 * A campaign's Engines in SCRIPTS (CAMPAIGN-SCRIPTS-1113, owner 2026-11-13 « un pick = toujours un script »), alias-free
 * so vitest reads it directly. features-service `GET /brands/{brandId}/sales-funnel-campaigns/{id}/engine-scripts`,
 * through the gateway `/v1/features/brands/:brandId/sales-funnel-campaigns/:id/engine-scripts`. From the campaign's
 * Target down, at each Engine it uses: the scripts its brief's strategy keeps (today's share of the Rating's draws among
 * them, adding to ~100), what the strategy rules out in words, the scripts it ran that are no longer runnable, and this
 * campaign's own runs of each. No decision score is served (client read). A 503 `script_rating_not_built_yet` reads as
 * « being built ». The page draws served values in served order: nothing divided, summed or ranked.
 */

const num = z.number();
const Llm = z.object({ place: z.string().nullable(), provider: z.string().nullable(), model: z.string().nullable() });
const Template = z.object({ place: z.string().nullable(), templateDynastySlug: z.string() });

export const CampaignScriptRowSchema = z.object({
  script: z.string(),
  dynasty: z.string(),
  /** The script's short plain-English name (workflow-service, relayed by features-service); null = not named yet. Optional until that ship serves it. */
  name: z.string().nullish(),
  version: num.nullable(),
  description: z.string().nullable(),
  shareOfDrawsPct: num.nullable(),
  drawnMost: z.boolean(),
  ruledOutReason: z.string().nullable(),
  llms: z.array(Llm),
  templates: z.array(Template),
  campaign: z.object({
    runs: num,
    reached: z.array(z.object({ outcome: z.string().nullable(), label: z.string().nullable(), runs: num })),
    spentUsd: num.nullable(),
    costPerRunUsd: num.nullable(),
    lastRunDay: z.string().nullable(),
  }),
});

export const CampaignEngineSchema = z.object({
  outcome: z.string(),
  label: z.string(),
  isTarget: z.boolean(),
  strategyState: z.string(),
  strategy: z.object({ id: z.string(), name: z.string(), description: z.string() }).nullable(),
  rules: z.array(z.object({ kind: z.string(), tacticId: z.string(), name: z.string(), clientLine: z.string().nullable() })),
  drawRule: z.string(),
  runsNow: z.string().nullable(),
  scripts: z.array(CampaignScriptRowSchema),
  ruledOut: z.array(CampaignScriptRowSchema),
  past: z.array(CampaignScriptRowSchema),
  campaign: z.object({ runs: num, spentUsd: num.nullable(), costPerRunUsd: num.nullable() }),
});

export const CampaignEngineScriptsSchema = z.object({
  salesFunnelCampaignId: z.string(),
  brandId: z.string(),
  target: z.object({ key: z.string(), label: z.string() }).nullable(),
  ratingComputedAt: z.string(),
  runsBuiltAt: z.string().nullable(),
  draws: num,
  engines: z.array(CampaignEngineSchema),
});

export type CampaignScriptRow = z.infer<typeof CampaignScriptRowSchema>;
export type CampaignEngine = z.infer<typeof CampaignEngineSchema>;
export type CampaignEngineScripts = z.infer<typeof CampaignEngineScriptsSchema>;

/** The served 503 reason while the Rating builds (a normal « being built »). */
export const SCRIPT_RATING_NOT_BUILT_YET = "script_rating_not_built_yet";

/** What the reader hands the page: the campaign's Engines, or « being built » (the served 503). */
export type CampaignEngineScriptsRead = { state: "ready"; data: CampaignEngineScripts } | { state: "building" };

/** How today's draws choose at an Engine, in words a client reads (served `drawRule`). */
export function drawRuleWords(rule: string): string {
  if (rule === "what_runs_led_to_per_cost") return "Drawn on what each script's runs led to, per dollar spent";
  if (rule === "what_runs_led_to") return "Drawn on what each script's runs led to";
  if (rule === "cheapest_per_run") return "Drawn on the cheapest per run, until results come in";
  if (rule === "no_script") return "No script can make this outcome for your campaign yet";
  return rule;
}

/** The brief's hold on an Engine, in words (served `strategyState`). */
export function strategyStateWords(state: string): string {
  if (state === "kept") return "Read from your brief";
  if (state === "no_condition") return "Your brief sets no condition here: every script competes";
  if (state === "not_judged_yet") return "Your brief is read on the first run here";
  return state;
}

/** A script's label on screen: its served short name; until it is named, its served description (clamped to one line by the page), else its dynasty. */
export function scriptLabel(row: Pick<CampaignScriptRow, "dynasty" | "description" | "name">): string {
  return row.name ?? row.description ?? row.dynasty;
}
