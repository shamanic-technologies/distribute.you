import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  fleetWorkflowRows,
  byServedRoiDesc,
  siblingLineAt,
  campaignWorkflowRows,
  shortWorkflowName,
  placeWords,
  tagsThatFit,
  servedRoi,
  servedCost,
  lastRunText,
  type FleetRankingRow,
  type ServedFigure,
  type CampaignLadderRow,
} from "../src/lib/live-workflow-rows";

function fleet(slug: string, o: Partial<FleetRankingRow> = {}): FleetRankingRow {
  return {
    rank: 1,
    workflowDynastySlug: slug,
    workflowDynastyName: slug.toUpperCase(),
    assignment: "active",
    selectable: true,
    isMature: true,
    costPerOutcomeUsd: 10,
    conversionRatePct: 1,
    outcomes: 3,
    spentUsd: 30,
    roiMultiple: 2,
    goesFirst: false,
    moneyGoesHere: false,
    figures: {
      roi: measured(2),
      costPerOutcomeUsd: measured(10),
      conversionRatePct: measured(1),
      spentUsd: { value: 30, unavailableReason: null },
      outcomes: 3,
    },
    ...o,
  };
}

function measured(value: number): ServedFigure {
  return { value, basis: "measured", expectedValue: null, unavailableReason: null };
}

describe("fleetWorkflowRows", () => {
  it("keeps the producer's order and flags verbatim, never re-ranking on cost", () => {
    const out = fleetWorkflowRows([
      fleet("nobelium", { rank: 2, costPerOutcomeUsd: 45, moneyGoesHere: true }),
      fleet("raven", { rank: 1, costPerOutcomeUsd: 14, isMature: false, goesFirst: true }),
      fleet("azalea", { rank: 3, costPerOutcomeUsd: 52 }),
    ]);
    expect(out.map((r) => r.slug)).toEqual(["raven", "nobelium", "azalea"]);
    expect(out.find((r) => r.first)?.slug).toBe("raven");
    expect(out.find((r) => r.cash)?.slug).toBe("nobelium");
  });

  it("carries the producer's place, explore price and runnability verbatim", () => {
    const [r] = fleetWorkflowRows([fleet("a", { place: "explore", explorePriceUsd: 0, executable: true })]);
    expect(r).toMatchObject({ place: "explore", explorePriceUsd: 0, executable: true });
    const [old] = fleetWorkflowRows([fleet("b")]);
    expect(old).toMatchObject({ place: null, explorePriceUsd: null, executable: null });
  });

  it("names why a row stands there; a cannot-run row says why it cannot run", () => {
    expect(placeWords({ place: "explore", executable: true, assignment: "active" })?.label).toBe("Explored first");
    expect(placeWords({ place: "money", executable: true, assignment: "active" })?.label).toBe("Best mature");
    expect(placeWords({ place: "proven_worse", executable: true, assignment: "active" })?.label).toBe("Proven pricier");
    expect(placeWords({ place: "cannot_run", executable: false, assignment: "active" })?.label).toBe("Retired: no version runs");
    expect(placeWords({ place: "cannot_run", executable: true, assignment: "deprecated" })?.label).toBe("Deprecated on this leg");
    expect(placeWords({ place: null, executable: null, assignment: "active" })).toBeNull();
  });

  it("carries the served figures, last run and tactics verbatim (RESEARCH-WF-FIGURES-1022)", () => {
    const [r] = fleetWorkflowRows([fleet("a", { lastRunAt: "2026-10-22T16:00:00.000Z", tactics: [{ id: "named-angle", name: "Named angle" }] })]);
    expect(r.figures.roi.value).toBe(2);
    expect(r).toMatchObject({ lastRunAt: "2026-10-22T16:00:00.000Z", lastRunUnavailableReason: null, tactics: [{ id: "named-angle", name: "Named angle" }] });
    const [u] = fleetWorkflowRows([fleet("b", { tactics: null, tacticsUnavailableReason: "tactics_unreadable" })]);
    expect(u).toMatchObject({ tactics: null, tacticsUnavailableReason: "tactics_unreadable", lastRunAt: null });
  });

  it("a workflow with no spend on the leg states no result yet", () => {
    const [r] = fleetWorkflowRows([fleet("a", { spentUsd: 0, outcomes: 0, costPerOutcomeUsd: null })]);
    expect(r.ran).toBe(false);
  });
});

function ladder(slug: string, o: Partial<CampaignLadderRow> = {}): CampaignLadderRow {
  return {
    audienceId: null,
    workflow: { workflowDynastySlug: slug, workflowDynastyName: slug.toUpperCase() },
    estimatesByGrain: {},
    rank: null,
    legAssignment: { state: "active", selectable: true },
    ...o,
  };
}

const half = (spent: number, contacted: number, outcomes: number) => ({
  spentUsd: spent,
  contacted,
  outcomes,
  costPerOutcomeUsd: outcomes > 0 ? spent / outcomes : null,
  conversionRatePct: contacted > 0 ? (100 * outcomes) / contacted : null,
});

describe("the served figures, as a Research row prints them", () => {
  it("a measured ROI prints as measured, the pipe's expected one marked expected, none = the producer's reason", () => {
    expect(servedRoi(measured(4.27))).toEqual({ value: 4.27, expected: false, reason: null });
    expect(servedRoi({ value: 3.48, basis: "expected", expectedValue: 3.48, unavailableReason: null })).toEqual({ value: 3.48, expected: true, reason: null });
    expect(servedRoi({ value: null, basis: null, expectedValue: null, unavailableReason: "no_return_on_pipe" })).toEqual({ value: null, expected: false, reason: "no_return_on_pipe" });
  });

  it("a cost per outcome in cents, expected when the producer says so, never Learning", () => {
    expect(servedCost(measured(161.59))).toMatchObject({ cents: 16159, expected: false, learning: false });
    expect(servedCost({ value: 186.36, basis: "expected", expectedValue: 186.36, unavailableReason: null })).toMatchObject({ cents: 18636, expected: true });
    expect(servedCost({ value: null, basis: null, expectedValue: null, unavailableReason: "no_outcome_on_pipe" }).cents).toBeNull();
  });

  it("last run reads as a short relative time; Never when it never ran; null when the producer could not read it", () => {
    const now = new Date("2026-10-22T18:00:00.000Z");
    const at = (iso: string) => lastRunText({ lastRunAt: iso, lastRunUnavailableReason: null }, now);
    expect(at("2026-10-22T17:59:40.000Z")).toBe("Just now");
    expect(at("2026-10-22T17:57:00.000Z")).toBe("3m ago");
    expect(at("2026-10-22T16:00:00.000Z")).toBe("2h ago");
    expect(at("2026-10-17T12:00:00.000Z")).toBe("5d ago");
    expect(at("2026-06-01T12:00:00.000Z")).toBe("4mo ago");
    expect(lastRunText({ lastRunAt: null, lastRunUnavailableReason: null }, now)).toBe("Never");
    expect(lastRunText({ lastRunAt: null, lastRunUnavailableReason: "not_read_on_pipe" }, now)).toBeNull();
  });
});

describe("campaignWorkflowRows", () => {
  it("reads the campaign's CAMPAIGN grain, never a coarser one, on the half its verdict names", () => {
    const [mature, learning, never] = campaignWorkflowRows({
      ladderRows: [
        ladder("a", {
          rank: 1,
          maturity: { isMature: true },
          estimatesByGrain: {
            crossOrg: { isMature: true, flash: half(999, 999, 99), mature: half(999, 999, 99) },
            campaign: { isMature: true, flash: half(40, 400, 4), mature: half(20, 200, 2) },
          },
        }),
        ladder("b", { rank: 2, maturity: { isMature: false }, estimatesByGrain: { campaign: { isMature: false, flash: half(6, 10, 0), mature: null } } }),
        ladder("c", { rank: 3, maturity: { isMature: true }, estimatesByGrain: { crossOrg: { isMature: true, flash: half(1, 1, 1), mature: half(1, 1, 1) } } }),
      ],
      roiBySlug: new Map([["a", 3]]),
      recommendedSlug: null,
    });
    expect(mature).toMatchObject({ slug: "a", mature: true, costPerOutcomeUsd: 10, outcomes: 2, spentUsd: 20, roiMultiple: 3, ran: true });
    // Zero outcomes states no price, never the spend as a floor.
    expect(learning).toMatchObject({ slug: "b", mature: false, costPerOutcomeUsd: null, outcomes: 0, spentUsd: 6 });
    // Never run by this campaign: no figures, but the workflow's own verdict is still stated.
    expect(never).toMatchObject({ slug: "c", ran: false, costPerOutcomeUsd: null, mature: true });
  });

  // Prod 2026-10-01 (brand c4b5284d): the rank tied on the offer and fell back to the slug, so
  // the first mature row was Dawn ($4.73/visit) while the producer recommended and ran Osprey
  // ($2.26/visit). The money row is the producer's recommendation, read, never re-derived.
  it("goes first = rank 1 whatever its verdict; money = the producer's recommendation", () => {
    const out = campaignWorkflowRows({
      ladderRows: [
        ladder("azalea", { rank: 6, maturity: { isMature: true } }),
        ladder("torrent", { rank: 1, maturity: { isMature: false } }),
        ladder("concerto", { rank: 2, maturity: { isMature: false } }),
        ladder("raven", { rank: 3, maturity: { isMature: false } }),
        ladder("nobelium", { rank: 4, maturity: { isMature: true } }),
      ],
      roiBySlug: new Map(),
      recommendedSlug: "azalea",
    });
    expect(out.map((r) => r.slug)).toEqual(["torrent", "concerto", "raven", "nobelium", "azalea"]);
    expect(out.find((r) => r.first)?.slug).toBe("torrent");
    expect(out.find((r) => r.cash)?.slug).toBe("azalea");
    expect(out.filter((r) => r.cash)).toHaveLength(1);
  });

  it("a non-selectable row neither goes first nor holds the money", () => {
    const out = campaignWorkflowRows({
      ladderRows: [
        ladder("dep", { rank: 1, maturity: { isMature: true }, legAssignment: { state: "deprecated", selectable: false } }),
        ladder("x", { rank: 2, maturity: { isMature: false } }),
        ladder("y", { rank: 3, maturity: { isMature: true } }),
      ],
      roiBySlug: new Map(),
      recommendedSlug: "dep",
    });
    expect(out.find((r) => r.first)?.slug).toBe("x");
    expect(out.some((r) => r.cash)).toBe(false);
  });

  it("drops audience rows; no recommendation = no money row", () => {
    const out = campaignWorkflowRows({
      ladderRows: [ladder("a", { rank: 1, maturity: { isMature: false } }), ladder("a", { rank: 1, audienceId: "aud-1" })],
      roiBySlug: new Map(),
      recommendedSlug: null,
    });
    expect(out.map((r) => r.slug)).toEqual(["a"]);
    expect(out.some((r) => r.cash)).toBe(false);
  });

  // Prod 2026-09-30 (brand 933d4abb, meeting booking campaign): an unassigned workflow the caller chose to
  // show keeps its row (the caller decides visibility, not the row model).
  it("keeps an unassigned row the caller passes", () => {
    const out = campaignWorkflowRows({
      ladderRows: [ladder("rhodium", { rank: 1, legAssignment: { state: "unassigned", selectable: false } })],
      roiBySlug: new Map(),
      recommendedSlug: null,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ slug: "rhodium", first: false });
  });
});

describe("research reads nothing scoped to the viewer", () => {
  const dir = join(__dirname, "../src/components/v2");
  const files = readdirSync(dir).filter((f) => f.startsWith("research-") && f.endsWith(".tsx"));
  it("no research component reads a brand-, offer-, campaign- or audience-scoped source", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const banned of ["getWorkflowRankLadder", "useBrandCampaignSpecs", "useCampaigns", "campaignId", "listAudiences", "getBrandOffer"]) {
        expect(src, `${f} must not read ${banned}`).not.toContain(banned);
      }
    }
  });

  it("the live table reads the fleet ranking at the pipe's leg", () => {
    const live = readFileSync(join(dir, "research-live-workflows.tsx"), "utf8");
    // the leg is the pipe's own key, judged proactive the renamed-leg-safe way (never fromKey === null)
    expect(live).toContain("legFor(useLegCatalogue(), PIPE_KEY[pipe].leg)");
    expect(live).toContain("isProactiveFrom(leg.fromKey)");
    expect(live).not.toContain("legKeyForSteps(");
    expect(live).toContain("getLegWorkflowRanking(featureSlug, leg)");
    expect(live).toContain("legWorkflowRankingKey(featureSlug, leg)");
    expect(live).toContain("enabled: legKey != null");
    // BEST-TPL-LLM-1022: a workflow fixes no template and no LLM, so neither column is drawn, and no
    // "Why here" column nor summary strip above the table (owner 2026-10-22).
    expect(live).not.toContain("writesWithNow");
    expect(live).not.toContain(">LLM</th>");
    expect(live).not.toContain(">Template</th>");
    expect(live).not.toContain("WhyHere");
    expect(live).not.toContain("<LiveRankingStrip");
    expect(live).not.toContain("<LiveWorkflowChips");
    expect(live).not.toContain("listChannelWorkflowStacks");
    expect(live).toContain("table-fixed");
    expect(live).not.toContain("useParams");
  });
});

describe("the brand Workflows page states the campaign's own live figures", () => {
  it("every Offer/Brand/Global cell states features-service's price for that grain, one format", () => {
    // The price features-service HOLDS per (grain, basis), cascade already walked (#1241).
    expect(page).toContain("held?.[grain]?.[basis].costPerOutcomeUsd ?? null");
    expect(page).toContain('offer: price("offer"), brand: price("brand"), global: price("crossOrg")');
    const cost = page.slice(page.indexOf("function CostCell("));
    expect(cost).not.toContain("spent,");
    expect(cost).not.toContain("Learning");
  });

  it("names a workflow by its distinctive name, the channel dropped (table and strip)", () => {
    expect(page).toContain("shortWorkflowName(name ?? slug, channelName)");
    expect(page).toContain("{shortName(w.row.workflowDynastyName, w.row.workflowDynastySlug)}");
    expect(page).toContain("nameOf={(row) => shortName(row.name, row.slug)}");
  });

  it("the money row is the producer's recommendation", () => {
    expect(page).toContain("recommendedSlug: r.ladder?.recommendedWorkflowDynastySlug ?? null");
  });

  const page = readFileSync(join(__dirname, "../src/components/v2/workflows-page.tsx"), "utf8");
  it("draws the strip, the chips and the live columns off the campaign's rows", () => {
    expect(page).toContain("<LiveRankingStrip rows={live}");
    expect(page).toContain("<LiveWorkflowChips row={liveRow} />");
    expect(page).toContain("<LiveWorkflowHeads");
    expect(page).toContain("<LiveWorkflowCells row={liveRow} showCost={false} />");
    // The campaign cost is the Offer column; a second cost column repeated it (owner, 2026-09-30).
    expect(page).toContain("<LiveWorkflowHeads />");
    // Rows keep the producer's rank order: no Offer / Brand / Global re-sort.
    expect(page).not.toContain("asc(cost(a.offer)");
    expect(page).toContain("colSpan={13}");
  });
});

describe("siblingLineAt", () => {
  it("reads the leg's own line first, else the one line, else none", () => {
    const two = { siblingLine: null, siblingLines: [{ legKey: "a", line: "Brand name" }, { legKey: "b", line: "No date" }] };
    expect(siblingLineAt(two, "b")).toBe("No date");
    expect(siblingLineAt(two, "c")).toBeNull();
    expect(siblingLineAt({ siblingLine: "Lightest brief", siblingLines: [] }, "a")).toBe("Lightest brief");
    expect(siblingLineAt(null, "a")).toBeNull();
  });
  it("the Research row prints the line, the full description on hover", () => {
    const live = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
    expect(live).toContain("{line ?? description}");
    expect(live).toContain("useWorkflowWords(r.slug, statuses, legKey)");
  });
});

describe("byServedRoiDesc", () => {
  const row = (slug: string, roi: number | null) => ({ slug, figures: { roi: roi == null ? { value: null, basis: null, expectedValue: null, unavailableReason: "x" } : measured(roi) } as never });
  it("puts the highest printed ROI first, a row with none last, ties in the producer's order", () => {
    const out = byServedRoiDesc([row("a", 0.6), row("b", null), row("c", 8.3), row("d", 3.5), row("e", 3.5), row("f", null)]);
    expect(out.map((r) => r.slug)).toEqual(["c", "d", "e", "a", "b", "f"]);
  });
  it("Research sorts each tab with it, and the title counts the live rows", () => {
    const live = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
    expect(live).toContain("active: byServedRoiDesc(out.active), deprecated: byServedRoiDesc(out.deprecated)");
    const catalog = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
    expect(catalog).toContain("count={live ? liveTotal : rows.length}");
    expect(catalog).toContain("countOf(k)");
  });
});

describe("shortWorkflowName", () => {
  it("drops the channel name from the front", () => {
    expect(shortWorkflowName("Sales Cold Email Outreach Maelstrom", "Sales Cold Email Outreach")).toBe("Maelstrom");
    expect(shortWorkflowName("sales cold email outreach Bronze-2", "Sales Cold Email Outreach")).toBe("Bronze-2");
  });
  it("keeps a name that does not start with it, or would be left empty", () => {
    expect(shortWorkflowName("Dawn", "Sales Cold Email Outreach")).toBe("Dawn");
    expect(shortWorkflowName("Sales Cold Email Outreach", "Sales Cold Email Outreach")).toBe("Sales Cold Email Outreach");
    expect(shortWorkflowName("Maelstrom", null)).toBe("Maelstrom");
  });
  it("Research renders the short name and paints before the Research file loads", () => {
    const catalog = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
    const live = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
    expect(live).toContain("name={nameOf(r)}");
    expect(catalog).toContain('if (!catalog && !itemKey && kind === "workflows" && liveLeg != null)');
  });
});

describe("Research pipe workflows: this pipe only, Active / Deprecated tabs (owner 2026-10-22)", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
  it("lists only the workflows the producer assigns to this pipe", () => {
    expect(src).toContain('.filter((r) => r.assignment === "active")');
  });
  it("splits on the workflow's own status, Active first, and renders the picked tab", () => {
    expect(src).toContain('dynastyStatuses.statusOf(r.slug) === "deprecated" ? "deprecated" : "active"');
    expect(src.indexOf('{ key: "active", label: "Active" }')).toBeLessThan(src.indexOf('{ key: "deprecated", label: "Deprecated" }'));
    expect(src).toContain('useState<StatusTab>("active")');
    expect(src).toContain("shown.map((r) =>");
    expect(src).toContain("<RecordsTabs");
  });
});

describe("Research pipe workflows: the owner's columns (2026-10-22)", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
  const status = readFileSync(join(__dirname, "../src/components/v2/research-status.tsx"), "utf8");
  const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");
  const thead = src.slice(src.indexOf("<thead>"), src.indexOf("</thead>"));

  it("mark, name, description, tactics, ROI, $/outcome, % conversion, $ spent, last run, status: in that order", () => {
    const order = ["w-36`}>Workflow</th>", ">Description</th>", "w-28`}>Tactics</th>", "<RoiLabel />", "{`$ ${outcomeUnit}`}", ">% Conversion</th>", ">$ Spent</th>", "w-24`}>Last run</th>", "w-28`}>Status</th>"];
    const at = order.map((h) => thead.indexOf(h));
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    expect(src).toContain("const COLS = 10;");
  });

  it("last run is the ranking row's own, as a short relative time", () => {
    expect(src).toContain("const lastRun = lastRunText(r);");
    expect(src).toContain("{lastRun ?? DASH}");
  });

  it("every row wears the workflow mark and links its name to its page", () => {
    expect(src).toContain('<CatalogueName kind="workflow" name={r.name ?? r.slug} label={name} icon={r.icon} color={r.color} className="font-medium" />');
    expect(src).toContain("title={`Open ${r.name ?? r.slug}`}");
  });

  it("the description is workflow-service's own words, the runnable one off the status listing, a deprecated one off its newest version", () => {
    expect(src).toContain("deprecated ? newest.description : statuses.descriptionOf(slug)");
    expect(status).toContain('["workflowDynastySummaries", featureSlug], () => getRunnableWorkflowDynastySummaries(featureSlug)');
    expect(api).toContain("description: newest?.description ?? null");
    expect(status).toContain('qc.refetchQueries({ queryKey: ["workflowDynastySummaries"] })');
  });

  it("every figure is the ranking row's served `figures`, list and drawer alike: one ROI everywhere", () => {
    // The legacy multiple read a measured 29x on a workflow with 0 outcomes; `figures.roi` is the one the page shows too.
    expect(src).not.toContain("roiMultiple");
    expect(src).not.toContain("roiDetail");
    expect(src.match(/<RoiValue roi=\{servedRoi\(r\.figures\.roi\)\} \/>/g)).toHaveLength(2);
    expect(src.match(/servedCost\(r\.figures\.costPerOutcomeUsd\)/g)).toHaveLength(2);
    expect(src.match(/<RateValue f=\{r\.figures\.conversionRatePct\} \/>/g)).toHaveLength(2);
    expect(src.match(/<SpentValue f=\{r\.figures\.spentUsd\} \/>/g)).toHaveLength(2);
    expect(src).toContain('{f.basis === "expected" && <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>}');
  });
});

describe("Research pipe workflows: tactics column and the row drawer (owner 2026-10-22)", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
  const drawer = readFileSync(join(__dirname, "../src/components/v2/research-template-outputs.tsx"), "utf8");
  const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");

  it("tactics are the ranking row's own (features-service's verdict), never one catalogue read per row", () => {
    expect(src).toContain("<TacticTags tactics={r.tactics} />");
    expect(src).toContain("const tactics = r.tactics;");
    expect(src).not.toContain("getStaffCatalogueObject");
    expect(src).not.toContain("useQueries");
    expect(api).toContain("tactics: z.array(z.object({ id: z.string(), name: z.string() })).nullish(),");
  });

  it("shows the first tags then +N more, the full list on hover or tap in a portalled popover", () => {
    expect(src).toContain("setFit(tagsThatFit(widths, el.clientWidth, MORE_W, TAG_GAP));");
    expect(src).toContain("new ResizeObserver(measure)");
    expect(src).toContain("<MoreTactics label={`+${rest} more`} tactics={tactics} />");
    expect(src).toContain('onPointerEnter={(e) => e.pointerType === "mouse" && show()}');
    expect(src).toContain('createPortal(\n          <div className="k-popover fixed');
  });

  it("the name is a link to the page; any other click on the row opens the drawer", () => {
    expect(src).toContain("if (opensDrawer(e.target, e.currentTarget)) onOpen();");
    expect(src).toContain('target.closest("a,button,input,textarea,select,[role=menu],[role=dialog]") == null');
    expect(src).toContain("!row.contains(target)");
    expect(src).toContain("<WorkflowDrawer");
    expect(src).toContain("Open workflow page");
  });

  it("the drawer is the one Research drawer shell, shared with the template version drawer", () => {
    expect(src).toContain("<ResearchDrawer");
    expect(drawer).toContain("export function ResearchDrawer(");
    expect(drawer.slice(drawer.indexOf("export function TemplateVersionDrawer("), drawer.indexOf("export function ResearchDrawer("))).toContain("<ResearchDrawer");
    expect(drawer).toContain("k-popover k-drawer-in fixed inset-y-0 right-0");
  });
});

describe("Research workflow recent runs (owner 2026-10-22)", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/research-live-workflows.tsx"), "utf8");
  const outputs = readFileSync(join(__dirname, "../src/components/v2/research-template-outputs.tsx"), "utf8");
  const catalog = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
  const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");

  it("the row drawer and the workflow page both list them", () => {
    expect(src).toContain("<RecentRuns slug={r.slug} limit={10} />");
    const view = catalog.slice(catalog.indexOf("function WorkflowView("), catalog.indexOf("function TemplateText("));
    expect(view).toContain("<RecentRuns slug={w.key} limit={20} />");
    expect(view).not.toContain('title="Last runs"');
  });

  it("each run shows date, template (dynasty + version) and LLM; a click opens its email in the Research drawer", () => {
    const body = outputs.slice(outputs.indexOf("export function RecentRuns("), outputs.indexOf("function OutputItem("));
    expect(body).toContain("{instantText(o.createdAt)}");
    expect(body).toContain("const template = runTemplateText(o);");
    expect(body).toContain("{o.model}");
    // The workflow version each run was on (WF-RUNS-OUTPUTS-1022-DASH), in the row and the email drawer.
    expect(body).toContain("{runVersionLabel(slug, o.workflowSlug)}");
    expect(body).toContain("Workflow version {runVersionLabel(slug, open.workflowSlug)}");
    expect(body).toContain("onClick={() => setOpen(o)}");
    expect(body).toContain("<ResearchDrawer");
    expect(body).toContain("<OutputsList read={{ outputs: [open], answered: true }} expanded />");
    expect(outputs).toContain("return `${o.templateDynasty.name} v${o.templateDynasty.position}`;");
  });

  it("reads content generation's workflow dynasty outputs through the staff gateway route", () => {
    expect(api).toContain("`/content/workflow-dynasties/${encodeURIComponent(slug)}/outputs?limit=${limit}`");
    expect(outputs).toContain('useAuthQuery(["workflowDynastyOutputs", slug, limit], () => getWorkflowDynastyOutputs(slug, limit)');
  });

  it("Esc closes only the top drawer (the email over the workflow drawer)", () => {
    expect(outputs).toContain('e.key === "Escape" && openLayers[openLayers.length - 1] === id.current');
  });
});

describe("tagsThatFit", () => {
  it("keeps every tag that fits, room for +N more when some are left out, never below one", () => {
    // 3 tags of 60px, gap 4, more 64: all three need 188px.
    expect(tagsThatFit([60, 60, 60], 188, 64, 4)).toBe(3);
    // 168px: two tags (124) + gap + more (64) = 192 > 168, one tag + more = 128 fits.
    expect(tagsThatFit([60, 60, 60], 168, 64, 4)).toBe(1);
    expect(tagsThatFit([60, 40, 60, 60], 172, 64, 4)).toBe(2);
    // A lone tag wider than the cell still shows (it truncates).
    expect(tagsThatFit([300], 168, 64, 4)).toBe(1);
    expect(tagsThatFit([300, 40], 168, 64, 4)).toBe(1);
  });
});
