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

  it("wears the charter's TERTIARY, the one accent every campaign surface reads in", () => {
    // Owner-decided: a campaign's pages read in one colour, and this tag is the one a
    // reader meets most often on them. All three classes are remapped in globals.css.
    for (const cls of ["bg-orange-50", "text-orange-600", "border-orange-200"]) {
      expect(src).toContain(cls);
    }
    // Green and red are VERDICTS, never accents — the tag says nothing went wrong.
    expect(src).not.toMatch(/(bg|text|border)-(green|red)-/);
    expect(src).not.toMatch(/bg-(violet|sky|teal|rose|lime)-/);
  });

  it("rotates to the BRAND's tertiary, so all three layers move together", () => {
    // Owner-decided: a customer's dashboard says "learning" in THEIR tertiary, not
    // ours. `tone-tile` is the opt-in, and the fill, the text and the border each
    // need a rotation rule or the pill renders two hues at once.
    expect(src).toContain("tone-tile");
    const css = read("app/globals.css");
    for (const sel of [
      ".tone-tile.bg-orange-50",
      ".tone-tile.text-orange-600",
      ".tone-tile.border-orange-200",
    ]) {
      expect(css).toContain(`:root[data-brand-tint] ${sel}`);
      expect(css).toContain(`html.dark:root[data-brand-tint] ${sel}`);
    }
  });

  it("carries a full-perimeter border, never a side accent", () => {
    expect(src).toContain("rounded-full border px-2");
    expect(src).toContain("border-orange-200");
    expect(src).toContain("border-gray-200");
    expect(src).not.toMatch(/border-(left|right|top)|border-l-|border-r-|border-t-/);
  });

  it("reads Paused in the pause grey when the campaign behind it is stopped", () => {
    // Same word and same tint as the status pill and the controls roll-up
    // (`bg-gray-100 text-gray-500 border-gray-200`), so one campaign is never
    // described two ways on one screen. `Learning` on a stopped campaign states a
    // process that is not running.
    expect(src).toContain('paused ? "Paused" : "Learning"');
    for (const cls of ["bg-gray-100", "text-gray-500", "border-gray-200"]) {
      expect(src).toContain(cls);
    }
    // A VERDICT never rotates with the brand hue — `tone-tile` stays on the tertiary
    // branch only.
    expect(src).toContain("tone-tile border-orange-200");
    expect(src).not.toMatch(/tone-tile[^"]*gray/);
    // Its own reason, not the learning one.
    expect(src).toContain("PAUSED_NOTE");
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
    // The terminal-reply outcome card and the mid-funnel reply pair are two render
    // sites for one number; gating one leaves the row contradicting itself.
    const hits = src.match(/isLearning\(spend\?\.positiveRepliesCount\)/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
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
    expect(src).toContain("learning ? <LearningTag withInfo={false} paused={paused} /> : <RoiCell");
    expect(src).toContain("learning ? <LearningTag withInfo={false} paused={paused} /> : fmtPct(revenue?.costOfAcquisitionPct)");
    // `$ Revenue` is a TOTAL, not a price: it grows with each outcome instead of being
    // decided by whichever one landed, so a thin campaign has a SMALL pipeline rather
    // than an unreliable one. `$ Invested` is money already spent, `$ Budget` a ceiling
    // the customer set. None of the three divides by an outcome count.
    expect(src).toContain("{fmtUsd(revenue?.totalPipelineUsd)}");
    expect(src).toContain("{fmtUsd(revenue?.committedCostUsd)}");
    expect(src).toContain("{fmtDailyBudgetUsd(budgetCents)}");
    expect(src).not.toContain("LearningTag withInfo={false} paused={paused} /> : fmtUsd(revenue?.totalPipelineUsd)");
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
    expect(cards).toContain("economicsLearning ? <LearningTag withInfo={false} paused={paused} /> : undefined");
    // Pipeline revenue is a TOTAL: it grows with each outcome rather than being decided
    // by whichever one landed, so a thin scope has a small pipeline, not a wrong one.
    const pipelineCard = cards.slice(cards.indexOf('label="Pipeline revenue"'), cards.indexOf('label="ROI"'));
    expect(pipelineCard).not.toContain("economicsLearning");
  });

  it("draws the curve PROVISIONAL rather than withholding it", () => {
    // A dotted grey line, no marked points and no fill: the reader sees the shape their
    // money has traced without reading it as a trend to act on. The paragraph this
    // replaced made people read a sentence to find out there was nothing to see.
    expect(trend).toContain("learning = false,");
    expect(trend).toContain('className={learning ? "text-gray-400" : "text-brand-600"}');
    expect(trend).toContain('strokeDasharray={learning ? "2 4" : undefined}');
    expect(trend).toContain('fill={learning ? "none" : "url(#roi-fill)"}');
    // NOTHING states a per-point value on the placeholder: no plotted dot, and no label
    // printed above one. Both invite a reading off a curve we just said is provisional.
    expect(trend).toContain("dot={false}");
    expect(trend).not.toContain("LabelList");
    // And NO hover card either. A tooltip is how a reader takes a reading, so offering
    // one hands back the value the dots and the labels were removed for — a third way of
    // stating it, wearing an interaction. The hovered point goes with it: it was that
    // tooltip's anchor. The measured chart keeps both.
    expect(trend).toContain("{!learning && (");
    expect(trend).toContain("activeDot={learning ? false : { r: 4 }}");
    // While learning the axis states its two ENDS and nothing between them, and both ends
    // span break-even so its dashed line is never clipped out of the domain.
    expect(trend).toContain("domain={learning && learningBounds ? learningBounds.domain : undefined}");
    expect(trend).toContain("ticks={learning && learningBounds ? learningBounds.ticks : undefined}");
    expect(trend).toContain("Math.min(...values, BREAK_EVEN)");
    // Under break-even the ceiling is a FIXED multiple, not the scope's own best day:
    // scaled to its own data a flat 0.0x line is drawn across the top of a 0-to-1 band
    // and reads as a result.
    expect(trend).toContain("const LEARNING_CEILING = 10;");
    expect(trend).toContain("Math.max(...values) < BREAK_EVEN ? LEARNING_CEILING");
    // The MEASURED chart keeps its middle: recharts drops ticks it thinks will not fit,
    // which on a short card leaves the two ends and nothing between them.
    expect(trend).toContain("tickCount={learning ? undefined : 5}");
    expect(trend).toContain("interval={0}");
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
    expect(table).toContain("moneyLearning ? <LearningTag withInfo={false} paused={campaignPaused} /> : formatPct(stats?.projection?.costOfAcquisitionPct)");
    expect(table).toContain("moneyLearning ? <LearningTag withInfo={false} paused={campaignPaused} /> : formatUsd(stats?.projection?.costPerPaidClientUsd)");
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
    expect(src).toContain("<LearningTag withInfo={false} paused={paused} />");
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

describe("a PAUSED campaign says so where it would have said Learning", () => {
  // The tag itself is guarded above. These pin the CALL SITES: a component that
  // HANDLES `paused` while no page passes it is the feature entirely absent with the
  // component perfectly correct.
  it("the campaign Overview derives it once and threads it to every surface it owns", () => {
    const page = read("components/campaigns/campaign-overview-page.tsx");
    expect(page).toContain(
      "const campaignPaused = campaign != null && !isRunningStatus(campaign.status);",
    );
    // The stat row, the section (which owns the return chart's tag) and the Top-3 card.
    expect((page.match(/paused=\{campaignPaused\}/g) ?? []).length).toBe(3);
  });

  it("the campaign Audiences table reads the campaign it already polls", () => {
    // No second read: the page holds `["campaign", campaignId]` for its funnel already.
    const table = read("components/audiences/customer-audiences-page.tsx");
    expect(table).toContain("const campaign = scopedCampaign;");
    expect(table).toContain(
      "const campaignPaused = campaign != null && !isRunningStatus(campaign.status);",
    );
    expect(table).toContain("paused={campaignPaused}");
    // Brand grain passes no campaign, so the flag is false there by construction —
    // several campaigns work those audiences and no single status answers for them.
    expect(table).toContain('const campaignScoped = Boolean(campaignId);');
  });

  it("a paused ROW in the Campaigns table states it too", () => {
    const table = read("components/campaigns/campaigns-table.tsx");
    expect(table).toContain("const paused = !isActiveStatus(campaign.status);");
    expect(table).toContain("<LearningTag withInfo={false} paused={paused} />");
  });

  it("every campaign-scoped entity page states it too, off the campaign it already polls", () => {
    // `OutreachStatCardsAuto` is the stat row on the campaign Leads page (and every
    // other campaign-scoped entity page). It holds `["campaign", id]` for the funnel
    // already, so the flag costs no second read; brand and offer grain fetch no
    // campaign, so `campaignData` is undefined and the flag is false by construction.
    const auto = read("components/revenue/outreach-stat-cards-auto.tsx");
    expect(auto).toContain(
      "const campaignPaused = scopedCampaign != null && !isRunningStatus(scopedCampaign.status);",
    );
    expect(auto).toContain("paused={campaignPaused}");
  });

  it("the return chart's tag follows the section's flag", () => {
    const section = read("components/revenue/revenue-overview-section.tsx");
    expect(section).toContain("paused={paused}");
    const chart = read("components/revenue/roi-trend-card.tsx");
    expect(chart).toContain("<LearningTag paused={paused} />");
  });
});

describe("LearningTag tone — which of the brand's accents a surface states", () => {
  const src = read("components/learning-tag.tsx");

  it("defaults to the TERTIARY, so a surface that states nothing is unchanged", () => {
    // The context's default is what every brand / offer / campaign Overview keeps
    // reading. A new tone must never repaint a surface nobody opted in.
    expect(src).toContain('createContext<LearningTone>("tertiary")');
  });

  it("states PRIMARY through the brand ramp, never a literal charter hex", () => {
    // `:root[data-brand-tint]` re-declares the whole `--color-brand-*` ramp at the
    // brand hue, so these rotate for free — an arbitrary-value charter hex would be
    // the one control that stays blue on a tinted dashboard.
    expect(src).toContain("border-brand-200 bg-brand-50 text-brand-600");
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/);
    // No `tone-tile` on the primary branch: that rotation is for the categorical
    // purple/indigo/blue/orange set, and adding it here would read as load-bearing.
    // Asserted on the class STRING, not file-wide — the module's own doc comment
    // explains why the primary needs no tile, and a loose regex trips on that.
    expect(src).not.toContain('"tone-tile border-brand');
  });

  it("keeps the primary tone legible on the dark surface, tinted AND untinted", () => {
    // Same gap that has bitten purple, green/red and orange in turn: a fill remapped
    // while the text and border beside it were not.
    const css = read("app/globals.css");
    for (const cls of [".bg-brand-50", ".text-brand-600", ".border-brand-200"]) {
      expect(css).toContain(`html.dark ${cls}`);
      expect(css).toContain(`html.dark[data-brand-tint] ${cls}`);
    }
  });

  it("pins the campaigns table to the tertiary, wherever it is mounted", () => {
    // It states CAMPAIGNS, so it reads in the campaign accent on every page — pinned
    // in the component rather than at each call site, or a new surface repaints it by
    // mounting it under a different tone.
    const table = read("components/campaigns/campaigns-table.tsx");
    expect(table).toContain('<LearningToneProvider tone="tertiary">');
    expect(table).toContain("<CampaignsTableInner {...props} />");
  });

  it("the funnel Overview states the primary, and only that page does", () => {
    // The page's own accent — the table inside it keeps its own by construction.
    const funnel = read("components/funnels/funnel-overview-page.tsx");
    expect(funnel).toContain('<LearningToneProvider tone="primary">');
    for (const page of [
      "components/campaigns/campaign-overview-page.tsx",
      "components/campaigns/campaigns-page.tsx",
      "components/funnels/offer-funnels-page.tsx",
    ]) {
      expect(read(page)).not.toContain("LearningToneProvider");
    }
  });

  it("states the primary on every OFFER-grain route, from the route and not the component", () => {
    // An offer reads in the brand's primary. All four of its surfaces are SHARED
    // components — the Overview is literally the brand page re-rendered — so the tone
    // is stated on the route: setting it inside the component would repaint the brand,
    // campaign and funnel grains that mount the same code.
    const OFFER = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]";
    for (const route of [
      `${OFFER}/page.tsx`,
      `${OFFER}/audiences/page.tsx`,
      `${OFFER}/audiences/leads/page.tsx`,
      `${OFFER}/funnels/page.tsx`,
    ]) {
      expect(read(route)).toContain('<LearningToneProvider tone="primary">');
    }
    // The shared components themselves state nothing, or the brand grain moves with them.
    for (const shared of [
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
      "components/audiences/customer-audiences-page.tsx",
      "components/audiences/engaged-leads-page.tsx",
    ]) {
      expect(read(shared)).not.toContain("LearningToneProvider");
    }
  });
});
