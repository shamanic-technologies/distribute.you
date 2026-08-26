import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEARNING_MIN_OUTCOMES,
  LEARNING_NOTE,
  isLearning,
  scopeIsLearning,
  audienceIsLearning,
} from "../src/lib/learning-threshold";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("isLearning", () => {
  it("is learning below the bar", () => {
    expect(isLearning(0)).toBe(true);
    expect(isLearning(1)).toBe(true);
    expect(isLearning(LEARNING_MIN_OUTCOMES - 1)).toBe(true);
  });

  it("stops at the bar, so exactly ten states a number", () => {
    expect(isLearning(LEARNING_MIN_OUTCOMES)).toBe(false);
    expect(isLearning(50)).toBe(false);
  });

  it("treats an ABSENT count as learning, never as enough", () => {
    // "We have no count" is not evidence that we have enough of them — a producer that
    // does not measure this outcome must not get a stated price by omission.
    expect(isLearning(null)).toBe(true);
    expect(isLearning(undefined)).toBe(true);
  });

  it("says why, in the note, without quoting a dollar figure", () => {
    expect(LEARNING_NOTE).toContain(String(LEARNING_MIN_OUTCOMES));
    expect(LEARNING_NOTE).not.toContain("$");
    // No em-dash in user-facing copy.
    expect(LEARNING_NOTE).not.toContain("—");
  });
});

describe("scopeIsLearning", () => {
  const row = (learning: boolean) => ({ learning });

  it("clears the moment ONE campaign is measured, however thin its siblings", () => {
    expect(scopeIsLearning([row(true), row(false), row(true)])).toBe(false);
  });

  it("is learning only while every campaign is", () => {
    expect(scopeIsLearning([row(true), row(true)])).toBe(true);
  });

  it("does not sum: three thin campaigns are three unreliable prices, not one reliable one", () => {
    // The rule is deliberately per-campaign rather than "does the scope's TOTAL clear
    // the bar" — adding unreliable prices does not make a reliable one.
    expect(scopeIsLearning([row(true), row(true), row(true)])).toBe(true);
  });

  it("treats a scope with NO campaigns as unmeasured, not learning", () => {
    // Nothing to have an opinion about — the surface reads exactly as it does today.
    expect(scopeIsLearning([])).toBe(false);
  });
});

describe("LearningTag", () => {
  const src = read("components/learning-tag.tsx");

  it("wears the SECONDARY, never a warning colour", () => {
    // Amber/orange reads as a warning about something the customer did wrong; this
    // is a waiting state. Purple is the charter's secondary (~44 degrees off the
    // primary blue), and all three classes are remapped in globals.css.
    for (const cls of ["bg-purple-50", "text-purple-600", "border-purple-200"]) {
      expect(src).toContain(cls);
    }
    expect(src).not.toMatch(/(bg|text|border)-(amber|orange|yellow|red)-/);
    expect(src).not.toMatch(/bg-(violet|sky|teal|rose|lime)-/);
  });

  it("rotates to the BRAND's secondary, so all three layers move together", () => {
    // Owner-decided: a customer's dashboard says "learning" in THEIR secondary, not
    // ours. `tone-tile` is the opt-in, and the fill, the text and the border each
    // need a rotation rule or the pill renders two hues at once.
    expect(src).toContain("tone-tile");
    const css = read("app/globals.css");
    for (const sel of [
      ".tone-tile.bg-purple-50",
      ".tone-tile.text-purple-600",
      ".tone-tile.border-purple-200",
    ]) {
      expect(css).toContain(`:root[data-brand-tint] ${sel}`);
      expect(css).toContain(`html.dark:root[data-brand-tint] ${sel}`);
    }
  });

  it("carries a full-perimeter border, never a side accent", () => {
    expect(src).toContain("border border-purple-200");
    expect(src).not.toMatch(/border-(left|right|top)|border-l-|border-r-|border-t-/);
  });

  it("explains itself through the shared InfoTooltip, never a native title", () => {
    expect(src).toContain("InfoTooltip");
    expect(src).not.toContain("title=");
  });
});

describe("the cost cards state Learning instead of a thin price", () => {
  const src = read("components/revenue/outreach-stat-cards.tsx");

  it("gates cost per website visit on the visit count the card beside it shows", () => {
    expect(src).toContain("costLearning: isLearning(clicks)");
  });

  it("gates both cost-per-positive-reply sites on the reply count", () => {
    // The terminal-reply outcome card and the mid-chain reply pair are two render
    // sites for one number; gating one leaves the row contradicting itself.
    const hits = src.match(/isLearning\(spend\?\.positiveRepliesCount\)/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("gates the goal's own outcome cost too, so one row cannot state two rules", () => {
    expect(src).toContain("costLearning: isLearning(outcomeCount)");
  });

  it("keeps the tracker CTA ahead of the tag", () => {
    // A tracker that is not live is WHY the count is thin, so "set this up" is the
    // actionable answer; the tag only speaks when there is nothing to set up.
    expect(src).toContain("outcomeCard.showAction ? trackerButton : null");
  });

  it("swaps the tooltip to the reason rather than keeping the price copy", () => {
    expect(src).toContain("LEARNING_NOTE");
  });

  it("leaves the COUNT cards alone — the real number is never hidden", () => {
    expect(src).toContain('label={clickMetric.label}');
    expect(src).toContain("value={clickMetric.value}");
  });
});

describe("the Audiences table", () => {
  const src = read("components/audiences/customer-audiences-page.tsx");

  it("keys each gated cost on the outcome its own column divides by", () => {
    for (const pair of [
      "cppr: (s) => s.evidence.positiveReplies",
      "cpc: (s) => s.evidence.websiteClicks",
      "cps: (s) => s.evidence.signups",
      "cpfs: (s) => s.evidence.formSubmissions",
      "cpsale: (s) => s.evidence.sales",
    ]) {
      expect(src).toContain(pair);
    }
  });

  it("states the tag in every one of those cells, not just the reported one", () => {
    for (const col of ["cppr", "cpc", "cps", "cpfs", "cpsale"]) {
      expect(src).toContain(`costIsLearning("${col}", stats)`);
    }
  });

  it("treats an absent stats row as absent, never as learning", () => {
    // The table already prints "-" for a row features-service returned nothing for.
    // Calling that learning would replace one honest answer with a different one.
    expect(src).toContain("if (!read || !stats) return false;");
  });

  it("does not rank a row by a price it is not showing", () => {
    // Learning rows sink below every measured one and order among themselves by the
    // outcome count the column divides by — which is the column beside it, so the order
    // the reader sees is the order the numbers on screen state.
    expect(src).toContain("const learningRank = (a: AudienceWire): number | null =>");
    expect(src).toContain("if (al != null && bl != null) return bl - al;");
  });
});

describe("the Campaigns table rows", () => {
  const src = read("components/campaigns/campaigns-table.tsx");
  const api = read("lib/api.ts");

  it("reads the volume off the group the producer serves, with no per-row fan-out", () => {
    // features-service answers the volume half on `?groupBy=campaignId` (v0.143.0), the
    // same block it already served per workflow — so the row's evidence rides the read
    // the table already makes. A per-row read of the un-grouped endpoint was the stopgap
    // before that landed and must not come back.
    expect(api).toContain("recipientsRepliesPositive: z.number().nullish()");
    expect(api).toContain("recipientsClicked: z.number().nullish()");
    expect(api).toContain("positiveReplies: g.outcomes?.recipientsRepliesPositive");
    expect(src).not.toContain("getFeatureRevenue(c.featureSlug");
    expect(src).not.toContain("evidenceQs");
  });

  it("counts the funnel's first MEASURED step, never its terminal outcome", () => {
    // A booked meeting or a signup needs the brand's conversion tracker live and is
    // legitimately 0 for most campaigns; gating on it would print Learning forever on a
    // campaign that is measurably working.
    expect(src).toContain('if (has("positive_replies")) return group.positiveReplies;');
    expect(src).toContain('if (has("website_visits")) return group.websiteClicks;');
  });

  it("treats an unanswered count as 'cannot tell', never as zero", () => {
    // The producer's block is `.optional()`, so an older payload parses — and a row it
    // says nothing about keeps stating its figures rather than being called thin.
    expect(src).toContain("if (!group) return undefined;");
    expect(src).toContain("signal === undefined ? false : isLearning(signal)");
  });

  it("gates the two RATIOS, and nothing else on the row", () => {
    // A return and its reciprocal are one statement in two units, so they move together.
    expect(src).toContain("learning ? <LearningTag withInfo={false} /> : <RoiCell");
    expect(src).toContain("learning ? <LearningTag withInfo={false} /> : fmtPct(revenue?.costOfAcquisitionPct)");
    // `$ Revenue` is a TOTAL, not a price: it grows with each outcome instead of being
    // decided by whichever one landed, so a thin campaign has a SMALL pipeline rather
    // than an unreliable one. `$ Invested` is money already spent, `$ Budget` a ceiling
    // the customer set. None of the three divides by an outcome count.
    expect(src).toContain("{fmtUsd(revenue?.totalPipelineUsd)}");
    expect(src).toContain("{fmtUsd(revenue?.committedCostUsd)}");
    expect(src).toContain("{fmtDailyBudgetUsd(budgetCents)}");
    expect(src).not.toContain("LearningTag withInfo={false} /> : fmtUsd(revenue?.totalPipelineUsd)");
  });

  it("does not rank a row by a return it is not showing", () => {
    expect(src).toContain("const byLearning = Number(a.learning) - Number(b.learning);");
  });
});

describe("the scope surfaces (offer and brand)", () => {
  const overview = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const cards = read("components/revenue/outreach-stat-cards.tsx");
  const auto = read("components/revenue/outreach-stat-cards-auto.tsx");
  const campaignsPage = read("components/campaigns/campaigns-page.tsx");
  const trend = read("components/revenue/roi-trend-card.tsx");

  it("derives the scope's state from the rows the Campaigns table renders", () => {
    // Same hook, same query keys — so it costs no network, and a header cannot state a
    // return every row beneath it is declining to state.
    for (const src of [overview, auto, campaignsPage]) {
      expect(src).toContain("scopeIsLearning(");
      expect(src).toContain("useCampaignRows(");
    }
  });

  it("gates the three RATIOS on the stat row and leaves Pipeline revenue alone", () => {
    expect(cards).toContain("economicsLearning ? <LearningTag withInfo={false} /> : undefined");
    // Pipeline revenue is a TOTAL: it grows with each outcome rather than being decided
    // by whichever one landed, so a thin scope has a small pipeline, not a wrong one.
    const pipelineCard = cards.slice(cards.indexOf('label="Pipeline revenue"'), cards.indexOf('label="ROI"'));
    expect(pipelineCard).not.toContain("economicsLearning");
  });

  it("draws the curve PROVISIONAL rather than withholding it", () => {
    // A dotted grey line with its points marked and no fill: the reader sees the shape
    // their money has traced without reading it as a trend to act on. The paragraph this
    // replaced made people read a sentence to find out there was nothing to see.
    expect(trend).toContain("learning = false,");
    expect(trend).toContain('className={learning ? "text-gray-400" : "text-brand-600"}');
    expect(trend).toContain('strokeDasharray={learning ? "2 4" : undefined}');
    expect(trend).toContain('fill={learning ? "none" : "url(#roi-fill)"}');
    expect(trend).toContain('{ r: 2, strokeWidth: 0, fill: "currentColor", className: "text-gray-400" }');
    expect(trend).not.toContain("Too few outcomes so far to draw a return");
    // Grey via currentColor, never a hex: an SVG stroke is not reached by the html.dark
    // remap, so a literal colour is invisible on one of the two themes.
    expect(trend).not.toMatch(/stroke="#[0-9a-f]{3,6}"/i);
    // And it is actually THREADED. The card's own branch was right for a day while the
    // page never passed the prop, so the graph kept drawing — assert the wiring, not
    // just the component that would honour it.
    expect(overview).toContain("<RevenueOverviewSection");
    const section = overview.slice(overview.indexOf("<RevenueOverviewSection"), overview.indexOf("<RevenueOverviewSection") + 400);
    expect(section).toContain("economicsLearning={economicsLearning}");
  });

  it("gates the price and the ranking-by-price on the Campaigns header, not the total", () => {
    const tiles = campaignsPage.slice(campaignsPage.indexOf('label="Pipeline generated"'));
    expect(tiles).toContain('label="Cost per acquisition"');
    expect(tiles).toContain('label="#1 acquisition channel"');
    const pipelineTile = campaignsPage.slice(
      campaignsPage.indexOf('label="Pipeline generated"'),
      campaignsPage.indexOf('label="Cost per acquisition"'),
    );
    expect(pipelineTile).not.toContain("scopeLearning");
  });
});

describe("audienceIsLearning + the per-audience gate", () => {
  const hook = read("lib/use-audience-learning.ts");
  const table = read("components/audiences/customer-audiences-page.tsx");

  it("clears an audience the moment ONE campaign has priced it", () => {
    expect(audienceIsLearning([12, 1])).toBe(false);
    expect(audienceIsLearning([1, 2, 3])).toBe(true);
  });

  it("does not pool counts across campaigns", () => {
    // Five replies in each of two campaigns is two unreliable prices; the table states a
    // price per audience, and adding them would invent a reliability neither has.
    expect(audienceIsLearning([5, 5])).toBe(true);
  });

  it("reads per CAMPAIGN, on the key that campaign's own Audiences page already polls", () => {
    expect(hook).toContain('"featureAudienceStats"');
    expect(hook).toContain("campaignId: campaign.id");
    expect(hook).toContain("useCampaignRows(brandId, featureSlug, offerId)");
  });

  it("counts the campaign's first MEASURED step, never its terminal outcome", () => {
    expect(hook).toContain('if (has("positive_replies")) return row.evidence.positiveReplies;');
    expect(hook).toContain('if (has("website_visits")) return row.evidence.websiteClicks;');
  });

  it("gates nothing until it can tell", () => {
    // Not settled, or a scope with no campaigns at all — the row reads as it does today.
    expect(hook).toContain("if (!settled || map.size === 0 || !audienceId) return false;");
    // But an audience the campaigns DO report on and that clears nothing is learning.
    expect(hook).toContain("return map.get(audienceId) ?? true;");
  });

  it("hides the three money columns for that row, and leaves $ Invested", () => {
    expect(table).toContain("const moneyLearning =");
    expect(table).toContain("moneyLearning ? <LearningTag withInfo={false} /> : formatPct(stats?.projection?.costOfAcquisitionPct)");
    expect(table).toContain("moneyLearning ? <LearningTag withInfo={false} /> : formatUsd(stats?.projection?.costPerPaidClientUsd)");
    expect(table).toContain("formatCents(stats.evidence.totalCostInUsdCents)");
  });

  it("does not rank a row by money it is not showing", () => {
    expect(table).toContain('const MONEY_COLS: SortCol[] = ["roi", "cacPct", "cacUsd"];');
  });
});

describe("the Top-3 audiences card", () => {
  const src = read("components/revenue/top-audiences-card.tsx");

  it("computes the gate from the row's own outcome count, only where a metric exists", () => {
    expect(src).toContain("const rowLearning = isStats && !!metric && isLearning(outcomes)");
  });

  it("drops the cost subtitle entirely on a learning row", () => {
    expect(src).toContain("brandLevelMoney || !metric || rowLearning");
  });

  it("puts the tag in the value slot instead of the return", () => {
    // Two ways in: the campaign card's own thin-outcome rule, and the scope's rule for
    // this audience. Either one replaces the value.
    expect(src).toContain("{rowLearning || scopeLearning ? (");
    expect(src).toContain("<LearningTag withInfo={false} />");
  });

  it("asks the SAME map the Audiences table asks about a row", () => {
    // Two surfaces answering "has this audience been priced" from one source, so the
    // card and the table can never disagree about the same row.
    expect(src).toContain("audienceLearningFor(learningByAudienceId ?? new Map(), key, learningSettled)");
    expect(src).toContain("!campaignScoped &&");
  });

  it("explains the tag from the header (i), never from inside the row's Link", () => {
    expect(src).toContain("const anyLearning");
    expect(src).toContain("anyLearning ? `${baseTip} ${LEARNING_NOTE}` : baseTip");
  });
});
