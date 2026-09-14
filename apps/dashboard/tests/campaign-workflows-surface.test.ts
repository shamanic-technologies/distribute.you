/**
 * The campaign Workflows surface: the CALL SITES, not only the components.
 *
 * A component perfectly able to rank itself on the producer's ladder is the feature
 * entirely absent if the page never reads the ladder — the threaded-prop trap this repo
 * keeps recording. So these guards read what the page actually DOES.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

const TABLE = read("src/components/workflows/campaign-workflows-page.tsx");
const PANEL = read("src/components/workflows/workflow-rank-panel.tsx");
const CELLS = read("src/components/workflows/workflow-cells.tsx");
const SIDEBAR = read("src/components/context-sidebar.tsx");
const API = read("src/lib/api.ts");
const PERSIST = read("src/lib/persist-cache.ts");
const HEADER = read("src/components/header-page-context.tsx");

/** Bound a slice to the next top-level declaration rather than a measured length. */
function sliceFn(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport async function ", at + marker.length);
  return src.slice(at, next === -1 ? undefined : next);
}

describe("the surface is BETA-gated on the email allowlist, nav AND body", () => {
  it("the sidebar entry is gated on useIsBetaUser and carries the badge", () => {
    const at = SIDEBAR.indexOf("function CampaignLevelSidebar(");
    const body = SIDEBAR.slice(at, SIDEBAR.indexOf("\nfunction ", at + 1));
    expect(body).toContain("useIsBetaUser()");
    expect(body).toContain('id: "campaign-workflows"');
    expect(body).toContain('maturity: "beta" as Maturity');
    expect(body).toContain("/workflows`");
  });

  it("does NOT reach for the dead PostHog gate", () => {
    // `useFeatureFlag` returns false for everyone in the dashboard, so gating on it
    // would hide the surface from staff too — the deleted-surface trap.
    expect(TABLE).not.toContain("useFeatureFlag");
  });

  it("the page body refuses a non-beta viewer and carries a visible badge", () => {
    expect(TABLE).toContain("useIsBetaUser");
    expect(TABLE).toContain("Not available");
    expect(TABLE).toContain('<MaturityBadge level="beta" />');
  });
});

describe("the channel is the CAMPAIGN's own", () => {
  it("the page never reads the brand's sole feature", () => {
    expect(TABLE).toContain("useScopedFeatureSlug(campaignId)");
    expect(TABLE).not.toContain("useSoleFeatureSlug");
  });
});

describe("the RANKING is the producer's, asked at the campaign's own LEG", () => {
  it("the page reads the rank ladder", () => {
    expect(TABLE).toContain("getWorkflowRankLadder");
    expect(TABLE).toContain("rankWorkflowRows");
  });

  it("sends the campaign's LEG, and the funnel only when it states none", () => {
    // `leg` wins over `funnel` at the producer, so sending both is a second source of
    // truth about what a campaign performs.
    const at = TABLE.indexOf("getWorkflowRankLadder({");
    expect(at).toBeGreaterThan(-1);
    const call = TABLE.slice(at, TABLE.indexOf("}),", at));
    expect(call).toContain("leg: legKey");
    expect(call).toContain("funnel: legKey ? null : funnelKey");
    expect(TABLE).toContain("campaign?.legKey ?? null");
  });

  it("the reader forwards exactly one of them, and asks for net", () => {
    const body = sliceFn(API, "export async function getWorkflowRankLadder(");
    expect(body).toContain('query.set("leg", params.leg);');
    expect(body).toContain("else if (params.funnel)");
    expect(body).toContain('query.set("pricing", "net")');
  });

  it("asks for the CAMPAIGN grain, and only alongside a leg", () => {
    // The producer 400s `campaign_requires_leg` rather than silently dropping one, so
    // the campaign rides the leg branch and nothing else.
    const body = sliceFn(API, "export async function getWorkflowRankLadder(");
    const legAt = body.indexOf('query.set("leg", params.leg);');
    const campaignAt = body.indexOf('query.set("campaignId", params.campaignId)');
    expect(legAt).toBeGreaterThan(-1);
    expect(campaignAt).toBeGreaterThan(legAt);
    expect(body.indexOf("else if (params.funnel)")).toBeGreaterThan(campaignAt);
  });

  it("the ladder's arguments ride its cache key", () => {
    // A leg-keyed answer and a funnel-keyed one are different bodies; sharing a key
    // serves one campaign's ranking to another's question. The campaign is in it for
    // the same reason: a body carrying its grain is a different answer.
    expect(TABLE).toContain('"workflowRankLadder",');
    expect(TABLE).toContain('legKey ?? "none",');
    expect(TABLE).toContain('legKey ? campaignId : "none",');
  });

  it("keeps the UNMEASURED rows, which is the whole reason it is a second reader", () => {
    const body = sliceFn(API, "export async function getWorkflowRankLadder(");
    // `measuredProjectionRows` is the NARROW reader's filter; applying it here would
    // delete the explore rows this page exists to offer.
    expect(body).not.toContain("measuredProjectionRows");
    expect(API).toContain("measured: z.boolean(),");
  });

  it("the narrow reader still drops them, so no other surface is widened", () => {
    const body = sliceFn(API, "export async function getWorkflowProjectionLadder(");
    expect(body.length).toBeGreaterThan(0);
    expect(API).toContain("rows: z.preprocess(measuredProjectionRows,");
  });

  it("draws one ROW per workflow PER SCOPE, and keeps every row the producer sent", () => {
    // A list cannot show a workflow several times, and the matrix cannot explain a rank
    // scored over audiences if the audiences were thrown away at the boundary.
    const at = TABLE.indexOf("function ladderRowsForScope(");
    expect(at).toBeGreaterThan(-1);
    expect(TABLE.slice(at, TABLE.indexOf("\nfunction ladderAllRows", at))).toContain(
      "scopeLadderRows(",
    );
    expect(TABLE).toContain("function ladderAllRows(");
    expect(TABLE).toContain("audienceRowsFor(allLadderRows,");
  });

  it("reads the recommendation rather than re-deriving an argmin", () => {
    expect(TABLE).toContain("recommendedWorkflowDynastySlug");
    expect(TABLE).not.toContain("Math.min(");
  });

  it("the RANK is read off the wire, never derived here", () => {
    // A page that ranked the rows it DISPLAYS produced a second order, and the two
    // disagreed: the recommended workflow sat 18th of 24 on a page whose own heading
    // said the list was ranked the way we pick. The producer scores it over every row a
    // workflow has — its audiences included — so rank 1 IS the recommendation.
    const rank = read("src/lib/workflow-rank-why.ts");
    expect(rank).toContain("rank: ladder?.rank ?? null,");
    expect(rank).not.toContain("function meritTier(");
    expect(API).toContain("rank: z.number().nullish(),");
  });

  it("names the outcome from the producer's own leg echo", () => {
    expect(TABLE).toContain("ladderQ.data?.leg?.toStep.label");
    expect(TABLE).toContain("ladderQ.data?.leg?.toStep.key");
  });

  it("a FAILED ladder read is stated, never swapped for a wider scope", () => {
    // The leg-keyed read legitimately 404s (`leg_not_declared`) and 502s
    // (`declared_funnels_unavailable`). Answering with the brand's numbers instead
    // would answer a question nobody asked.
    expect(TABLE).toContain("ladderQ.isError");
    expect(TABLE).toContain("rankUnavailable");
    expect(TABLE).toContain("so the list is");
  });
});

describe("the three grain TABS are gone, and the matrix replaced them", () => {
  it("offers no tab at all", () => {
    // They swapped which evidence three columns were read from while the rank stayed
    // put, so they could not answer why the order was what it was — which is the whole
    // complaint. Campaign is a COLUMN now; Brand has no meaning on a campaign page;
    // Global is read in the panel, which already lists every grain at once.
    expect(TABLE).not.toContain("WORKFLOW_GRAINS.map(");
    expect(TABLE).not.toContain("setGrain(");
    expect(TABLE).not.toContain("WORKFLOW_GRAIN_LABEL");
    expect(TABLE).not.toContain("WORKFLOW_GRAIN_NOTE");
    const grains = read("src/lib/workflow-grains.ts");
    expect(grains).not.toContain("export const WORKFLOW_GRAIN_LABEL");
    expect(grains).not.toContain("export const WORKFLOW_GRAIN_NOTE");
    // The cascade ORDER survives — the panel still reads it.
    expect(grains).toContain('export const WORKFLOW_GRAINS: readonly WorkflowGrain[] = ["campaign", "brand", "crossOrg"];');
  });

  it("every cell comes off the ONE ladder read — no second endpoint per column", () => {
    // The grains used to be four separate reads stitched together, which is how two
    // tabs come to state different money for one workflow.
    for (const gone of [
      "getBrandRevenueByWorkflow",
      "getOfferRevenueByWorkflow",
      "getFleetWorkflowOutreach",
      "buildFleetWorkflowRows",
    ]) {
      expect(TABLE, gone).not.toContain(gone);
    }
    expect(TABLE).toContain("buildMatrixCellIndex(matrixRows)");
    expect(TABLE).toContain("(ladderQ.data?.rows ?? []) as unknown as MatrixLadderRow[]");
  });

  it("carries no section split", () => {
    expect(TABLE).not.toContain("sectionCampaignWorkflowRows");
    expect(TABLE).not.toContain("Not measured yet");
  });
});

describe("THE MATRIX — rows are the served rank, columns the served audience order", () => {
  it("orders the rows on the producer's rank and nothing else", () => {
    expect(TABLE).toContain("matrixWorkflowOrder(matrixRows)");
    const matrix = read("src/lib/workflow-matrix.ts");
    const body = matrix.slice(
      matrix.indexOf("export function matrixWorkflowOrder("),
      matrix.indexOf("export function scopeRankedRows("),
    );
    expect(body).not.toContain("costPerOutcomeUsd");
  });

  it("orders the columns on `/audience-stats`, in the order served", () => {
    // That read already ranks a campaign's audiences on their own pooled cost per
    // outcome. Ranking them on their best LADDER cell instead ties most of them at one
    // inherited floor and says nothing.
    expect(TABLE).toContain("fetchFeatureAudienceStats(");
    const at = TABLE.indexOf("const audienceColumns = useMemo(");
    const body = TABLE.slice(at, TABLE.indexOf("const matrixOrder", at));
    expect(body).toContain("audienceStatsQ.data?.audiences ?? []");
    // Filtered to the scopes the ladder carries, never re-sorted.
    expect(body).toContain("knownScopes.has(a.audienceId)");
    expect(body).not.toContain(".sort(");
  });

  it("the audience-stats key is byte-equal to the campaign Overview's, so it dedupes", () => {
    const overview = read("src/components/campaigns/campaign-overview-page.tsx");
    expect(overview).toContain('"featureAudienceStats", featureSlug, brandId,');
    expect(TABLE).toContain(
      '["featureAudienceStats", featureSlug, brandId, funnelKey ?? "none", "campaign", campaignId]',
    );
  });

  it("a cell is a SERVED figure, addressed by (workflow, column)", () => {
    expect(TABLE).toContain("cells.get(matrixCellKey(r.dynastySlug, null))");
    expect(TABLE).toContain("cells.get(matrixCellKey(r.dynastySlug, a.audienceId))");
    expect(TABLE).toContain("fmtUsd(cell.costPerOutcomeUsd)");
  });

  it("a cell resting on its OWN evidence is distinct from an inherited floor", () => {
    // 21 of 24 rows repeat one figure across every column, so the split is what makes
    // the grid legible rather than confusing.
    expect(TABLE).toContain("cellRestsOnOwnEvidence(cell)");
    expect(TABLE).toContain('own ? "font-medium text-gray-900" : "text-gray-400"');
  });

  it("a cell the ladder does not carry states NOTHING, never a zero", () => {
    expect(TABLE).toContain("!cell || cell.costPerOutcomeUsd == null");
  });

  it("lights ONE cell per column: the workflow that column would be put on", () => {
    // A single global mark answered "where is the cheapest price" and left the other
    // twelve columns saying nothing. Each column now states its own pick, served.
    expect(TABLE).toContain("columnBestCells(matrixRows)");
    expect(TABLE).toContain("isColumnBestCell(columnBest, r.dynastySlug, null)");
    expect(TABLE).toContain("isColumnBestCell(columnBest, r.dynastySlug, a.audienceId)");
    expect(TABLE).not.toContain("bestMatrixCell");
    expect(TABLE).not.toContain("isBestCell");
  });

  it("a LIT cell still says whose EVIDENCE it rests on", () => {
    // The two marks answer different questions and both ride the same cell. Collapsing
    // them would put the footer's own sentence in front of thirteen cells showing no
    // such thing — and in prod 11 of the 13 picks are inherited floors.
    const at = TABLE.indexOf("function MatrixCellTd(");
    const body = TABLE.slice(at, TABLE.indexOf("export function ScopeTable(", at));
    expect(body).toContain('own ? "font-semibold text-brand-700" : "font-normal text-brand-600"');
  });

  it("says what the highlight MEANS once, not once per lit cell", () => {
    // The mark now fires once per column, so a per-cell tooltip would be the same
    // sentence thirteen times across one grid — which is why the ordinary cells never
    // had one either. The header tip and the footer carry it.
    expect(TABLE).toContain(
      "The highlighted cell in each column is the workflow we would put that audience on.",
    );
    expect(TABLE).not.toContain("BEST_CELL_TIP");
  });

  it("highlights row 1 and the best column", () => {
    expect(TABLE).toContain('r.rank === 1');
    expect(TABLE).toContain('column && !best ? "bg-gray-50" : ""');
  });

  it("the running row sits at its SERVED rank and is never moved to the top", () => {
    // It used to be pinned first, which put a row the producer ranks seventh at the top
    // of a table whose whole subject is the producer's order. It keeps its tag instead:
    // what is happening is marked where it belongs rather than duplicated at rank 1.
    const at = TABLE.indexOf("const matrixDisplayRows = useMemo(");
    const body = TABLE.slice(at, TABLE.indexOf("const scopeLadder", at));
    expect(body).not.toContain(".splice(");
    expect(body).not.toContain("pinned");
    expect(body).not.toContain("m.row.running");
    // And it is never renumbered: a `#1` badge on a row the producer ranks seventh
    // would be this surface stating something the ladder does not.
    expect(body).not.toContain("rank: 1,");
    expect(TABLE).toContain('{r.rank ?? "—"}');
    expect(TABLE).toContain("Running");
  });

  it("the rows are the CATALOGUE's, so a retired lineage the ladder prices gets none", () => {
    expect(TABLE).toContain("rowBySlug.get(m.dynastySlug) ?? null");
    expect(TABLE).toContain("m.row !== null");
  });
});

describe("THE PER-AUDIENCE LIST reads scopeRank, the position that ascends on its figure", () => {
  it("orders on the producer's scopeRank, never on the merit rank", () => {
    // Ordered on `rank`, a per-audience list would ascend on a number it is not
    // showing — the exact bug the matrix replaced, one scope down.
    expect(TABLE).toContain('orderBy: "scopeRank"');
    const rank = read("src/lib/workflow-rank-why.ts");
    expect(rank).toContain('orderBy === "scopeRank" ? l.scopeRank : l.rank');
  });

  it("states the scope position and puts Current best on its first row", () => {
    expect(TABLE).toContain('{ranked.scopeRank ?? "—"}');
    expect(TABLE).toContain("const bestHere = ranked.scopeRank === 1;");
    expect(TABLE).toContain("Current best");
  });

  it("reads THIS scope's own figures, never a coarser grain wearing its name", () => {
    const at = TABLE.indexOf("function scopeFigures(");
    const body = TABLE.slice(at, TABLE.indexOf("export function CampaignWorkflowsPage", at));
    expect(body).toContain("audienceId ? row.estimatesByGrain.audience : row.estimatesByGrain.campaign");
  });

  it("the ladder it ranks on is that scope's own column", () => {
    expect(TABLE).toContain("ladderRowsForScope(ladderQ.data, scope)");
  });

  it("an unknown scope in the URL is NOT a scope", () => {
    // An id somebody pasted must not paint an empty table that reads as "this audience
    // produced nothing".
    expect(TABLE).toContain("scopeParam && knownScopes.has(scopeParam) ? scopeParam : null");
  });

  it("the open scope lives in the query string, so a link still works", () => {
    expect(TABLE).toContain('setParam("scope", id)');
    expect(TABLE).toContain('searchParams.get("scope")');
  });

  it("keeps the sentence on a phone, where its own column folds away", () => {
    // It is the answer to the page's whole question, so it may not be what a phone
    // loses.
    expect(TABLE).toContain('<p className="mt-1 text-xs text-gray-500 md:hidden">{ranked.why}</p>');
  });

  it("prints an EXPLORE allowance as a floor, never as a price", () => {
    // It is the cost of one outreach, cheapest by construction; printing it as a price
    // would make the cheapest row on the page the least proven one.
    expect(TABLE).toContain("ranked.measured ?");
    expect(TABLE).toContain("from {fmtUsd(ranked.estCostPerOutcomeUsd)}");
  });

  it("states the why on every row", () => {
    expect(TABLE).toContain("{ranked.why}");
  });
});

describe("THE SIDEBAR is the campaign then the producer's audience order", () => {
  it("puts the campaign first and never re-sorts the audiences", () => {
    const at = TABLE.indexOf("function ScopeSidebar(");
    const body = TABLE.slice(at, TABLE.indexOf("function WorkflowMatrix(", at));
    expect(body).toContain("Campaign");
    expect(body).toContain("audiences.map((a, i)");
    expect(body).not.toContain(".sort(");
  });

  it("gives every audience its face, and the first one Best", () => {
    const at = TABLE.indexOf("function ScopeSidebar(");
    const body = TABLE.slice(at, TABLE.indexOf("function WorkflowMatrix(", at));
    expect(body).toContain("<AudienceAvatar");
    expect(body).toContain("i === 0 &&");
  });
});

describe("the detail PAGE is gone and its route redirects", () => {
  const ROUTE =
    "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/campaigns/[id]/workflows/[workflowDynastySlug]/page.tsx";

  it("the component file no longer exists", () => {
    expect(
      fs.existsSync(
        path.join(__dirname, "..", "src/components/workflows/campaign-workflow-detail-page.tsx"),
      ),
    ).toBe(false);
  });

  it("the old URL still lands somewhere true", () => {
    const src = read(ROUTE);
    expect(src).toContain("redirect(");
    expect(src).toContain("workflows?workflow=");
    expect(src).toContain("encodeURIComponent(");
  });
});

describe("the panel opens from a row and from the URL", () => {
  it("the page mounts it", () => {
    expect(TABLE).toContain("<WorkflowRankPanel");
  });

  it("the open workflow lives in the query string, so a link still works", () => {
    expect(TABLE).toContain('searchParams.get("workflow")');
    expect(TABLE).toContain('setParam("workflow", slug)');
    expect(TABLE).toContain("next.set(key, value)");
    expect(TABLE).toContain("next.delete(key)");
  });

  it("opening a row navigates NOWHERE — the ranking stays on screen", () => {
    expect(TABLE).not.toContain("router.push(");
    expect(TABLE).toContain("router.replace(");
  });

  it("the panel is an OVERLAY, the Leads panel's own shell", () => {
    expect(PANEL).toContain("absolute inset-0 md:left-auto");
    // z-20: above the list, below the support FAB (z-30), which is why it carries its
    // own bottom clearance.
    expect(PANEL).toContain("z-20 pb-24");
  });

  it("carries the four cards", () => {
    for (const title of [
      'title="Rank and why"',
      'title="How we priced it"',
      'title="On this campaign"',
      'title="Against every client we run it for"',
    ]) {
      expect(PANEL, title).toContain(title);
    }
  });

  it("draws a chart ONLY where its series carries something", () => {
    // An empty chart reads as a zero, which is the one thing an absent figure must
    // never say.
    expect(PANEL).toContain("hasOutcomeSeries");
    expect(PANEL).toContain("hasRoiHistory");
    expect(PANEL).toContain("{hasOutcomeSeries && (");
    expect(PANEL).toContain("{hasRoiHistory && (");
  });

  it("marks the grain the NUMBERS came from, not the provenance LABEL", () => {
    // They are decoupled: a row labelled `crossOrg` whose basis is `charged` was priced
    // on this brand's own floored spend, so marking the label's block would point at
    // the fleet on a figure that is the customer's own.
    expect(PANEL).toContain("const usedGrain");
    expect(PANEL).toContain("ladderRow?.estimatesByGrain.audience");
    expect(PANEL).not.toContain("usedGrain = ladder.grain");
    // The campaign sits between brand and audience in that cascade; omitting it marked
    // THIS BRAND as the source on every campaign-scoped read.
    const cascade = PANEL.slice(PANEL.indexOf("const usedGrain"), PANEL.indexOf("const siblingRows"));
    expect(cascade.indexOf("estimatesByGrain.audience")).toBeLessThan(
      cascade.indexOf("estimatesByGrain.campaign"),
    );
    expect(cascade.indexOf("estimatesByGrain.campaign")).toBeLessThan(
      cascade.indexOf("estimatesByGrain.brand"),
    );
  });

  it("a grain with nothing spent says so rather than being silently absent", () => {
    expect(PANEL).toContain("Nothing spent here yet, so it is not used.");
  });

  it("each grain states the COST PER OUTCOME, the figure the ranking is made of", () => {
    // It used to state `costPerContactedUsd` — a cost per person reached, which nothing
    // ranks on and which no reader could reconcile with the estimate above it.
    expect(PANEL).toContain("fmtUsd(figures.costPerOutcomeUsd)");
    expect(PANEL).toContain("Cost per {outcomeNoun.toLowerCase()}");
    expect(PANEL).not.toContain("Cost per person reached");
    expect(PANEL).not.toContain("costPerContactedUsd");
  });

  it("each grain names its accounting basis in the customer's words", () => {
    expect(PANEL).toContain("block.costBasis");
    expect(PANEL).toContain("What you paid");
    expect(PANEL).toContain("What it costs us");
  });

  it("the grains are the three a reader compares, campaign first", () => {
    const order = PANEL.slice(PANEL.indexOf("const GRAIN_ORDER"), PANEL.indexOf("const AUDIENCES_TIP"));
    expect(order.indexOf('key: "campaign"')).toBeGreaterThan(-1);
    expect(order.indexOf('key: "campaign"')).toBeLessThan(order.indexOf('key: "brand"'));
    expect(order.indexOf('key: "brand"')).toBeLessThan(order.indexOf('key: "crossOrg"'));
  });

  it("lists EVERY audience the workflow ran for, which is what explains the rank", () => {
    // The rank is scored over the audience rows too, so a workflow can top the table on
    // a figure that appears in no column. This card is where that figure lives.
    expect(PANEL).toContain("<AudienceGrainList");
    expect(PANEL).toContain("rows={audienceRows}");
    expect(PANEL).toContain("audienceById");
    // An audience we cannot name still gets its row — its evidence is real.
    expect(PANEL).toContain("An audience we could not name");
  });

  it("the page HANDS it the rows rather than the panel fetching a second time", () => {
    const at = TABLE.indexOf("<WorkflowRankPanel");
    const call = TABLE.slice(at, TABLE.indexOf("onClose=", at));
    expect(call).toContain("ladderRow={campaignColumnRowFor(allLadderRows,");
    expect(call).toContain("audienceRows={audienceRowsFor(allLadderRows,");
    expect(call).toContain("audienceById={audienceById}");
  });
});

describe("naming an audience is a DISPLAY lookup on a key the app already polls", () => {
  it("reads the brand's audiences under the shared root, and fetches none per row", () => {
    expect(TABLE).toContain('["audiences", brandId]');
    expect(TABLE).toContain("listAudiences(brandId)");
    // A per-audience fetch on a table of 24 workflows x 12 audiences is 288 requests.
    expect(TABLE).not.toContain("getAudience(");
  });

  it("the brand's own mark rides the key the tenant switcher already polls", () => {
    expect(TABLE).toContain('["brand", brandId]');
    expect(TABLE).toContain("getBrand(brandId)");
  });
});

describe("every money read is CAMPAIGN-scoped and net", () => {
  it("the grouped read carries the campaign in the request AND the key", () => {
    expect(TABLE).toContain('["campaignWorkflowRevenue", brandId, campaignId]');
    expect(TABLE).toContain("getFeatureRevenueByWorkflow(featureSlug as string, brandId, campaignId)");
  });

  it("the grouped reader carries the campaign and asks for net", () => {
    const body = sliceFn(API, "export async function getFeatureRevenueByWorkflow(");
    expect(body).toContain("{ brandId, campaignId, groupBy: \"workflow\" }");
    expect(body).toContain('query.set("pricing", "net")');
  });

  it("the panel's drill-down is the campaign's own body", () => {
    expect(PANEL).toContain('["workflowRevenue", brandId, campaignId, dynastySlug]');
  });
});

describe("nothing is computed in the browser", () => {
  it("no division anywhere on either surface", () => {
    for (const [name, src] of [
      ["table", TABLE],
      ["panel", PANEL],
    ] as const) {
      // `/ 100` would be a cents-to-dollars conversion done here rather than by the
      // shared formatter; anything else is a metric.
      expect(src, name).not.toMatch(/\)\s*\/\s*\(/);
      expect(src, name).not.toContain("/ 100");
    }
  });

  it("the ranking module divides nothing either", () => {
    // Read the CODE, not the doc comment: the prose legitimately writes "audience /
    // brand / fleet", which a whole-file regex cannot tell apart from arithmetic.
    const rank = read("src/lib/workflow-rank-why.ts");
    const code = rank
      .split("\n")
      .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
      .join("\n");
    expect(code).not.toContain("/ 100");
    expect(code).not.toMatch(/[a-zA-Z0-9_)\]]\s*\/\s*[a-zA-Z0-9_(]/);
  });

  it("the cost cells read the scope's OWN served figures, verbatim", () => {
    // `legOutcome` is the producer's per-grain block for the leg the request named —
    // the cost, the count and the spend behind them. The page picks a block and renders
    // its fields; it computes none of them.
    expect(TABLE).toContain("scopeFigures(bySlug.get(r.row.workflowDynastySlug) ?? null, audienceId)");
    expect(TABLE).toContain("grainFigures(");
    expect(TABLE).toContain("fmtUsd(figures.costPerOutcomeUsd)");
    expect(TABLE).toContain("fmtCount(figures.outcomeCount)");
    expect(TABLE).toContain("fmtUsd(figures.spentUsd)");
    expect(TABLE).toContain("ranked.estCostPerOutcomeUsd");
  });

  it("the grain module divides nothing either", () => {
    const grains = read("src/lib/workflow-grains.ts");
    expect(grains).not.toMatch(/[^/*]\s\/\s[^/*]/);
    expect(grains).not.toContain("reduce(");
  });
});

describe("a figure the producer could not measure reads as absent, never zero", () => {
  it("both surfaces render an em dash for a null", () => {
    for (const [name, src] of [
      ["table", TABLE],
      ["panel", PANEL],
    ] as const) {
      expect(src, name).toMatch(/value ===? null \? "—"/);
    }
  });
});

describe("the learning bar is the repo's ONE bar", () => {
  it("the page imports it rather than restating a threshold", () => {
    expect(TABLE).toContain('import { isLearning } from "@/lib/learning-threshold"');
    expect(TABLE).not.toMatch(/>=?\s*10\b/);
  });

  it("a stopped campaign says Paused, and only the campaign can say it", () => {
    expect(TABLE).toContain("useScopePaused(brandId, { campaignId, enabled: isBeta })");
    expect(TABLE).toContain("<LearningTag paused={paused} />");
  });
});

describe("reveal on SETTLE — an errored read paints its state, never a skeleton forever", () => {
  it("every gate pairs isPending with isError", () => {
    for (const q of ["catalogueQ", "campaignRevQ", "ladderQ"]) {
      expect(TABLE, q).toContain(`(${q}.isPending && !${q}.isError)`);
    }
  });
});

describe("the fleet comparison states its own basis", () => {
  it("the panel names the incurred basis in its own words", () => {
    expect(PANEL).toContain("including anything we later refunded");
  });

  it("it is drawn apart from the campaign's own figures", () => {
    expect(PANEL).toContain('title="Against every client we run it for"');
  });
});

describe("the table survives a phone and the dark theme", () => {
  it("bounds the identity cell so a long name can truncate", () => {
    // `truncate` does NOTHING under `table-auto`: the column sizes to its content, so
    // one long dynasty name widens the row and the wrapper scrolls sideways.
    expect(TABLE).toContain("table-fixed text-sm md:table-auto");
    expect(TABLE).toContain('w-[46%] px-4 py-3 md:w-[20%]');
  });

  it("gates the min-width at the SAME breakpoint the folded columns return", () => {
    // An unconditional floor re-widens the row on a phone and pushes the columns that
    // DO render off to the right, which reads as the data being missing.
    expect(TABLE).toContain("md:min-w-[1100px]");
    expect(TABLE).not.toContain('className="w-full min-w-[');
    // Six of the nine columns fold below `md`: LLM, Template, the outcome count, the
    // outcome cost, $ Invested and Why. Each appears twice — its header and its cell.
    expect((TABLE.match(/hidden md:table-cell|md:table-cell/g) ?? []).length).toBeGreaterThan(0);
  });

  it("lets the identity row WRAP, or the pill squeezes the name to zero width", () => {
    expect(TABLE).toContain("flex min-w-0 flex-wrap items-center");
  });

  it("tints the running row with a class the dark remap can match", () => {
    // `bg-brand-50/40` compiles past `html.dark .bg-brand-50`, so the row paints a
    // LIGHT block on the dark surface.
    expect(TABLE).not.toContain("bg-brand-50/");
    expect(TABLE).toContain('row.running ? "bg-brand-50"');
  });

  it("every tint it uses carries a dark remap", () => {
    const globals = read("src/app/globals.css");
    for (const cls of [
      "bg-brand-50",
      // The best cell's own mark, and the only place the grid raises its voice.
      "bg-brand-100",
      "border-brand-200",
      "border-brand-300",
      "text-brand-600",
      "text-brand-700",
      "bg-gray-50",
      "bg-gray-100",
      // A muted floor and an absent cell.
      "text-gray-400",
      "text-gray-300",
    ]) {
      expect(globals, cls).toContain(`html.dark .${cls} {`);
    }
  });

  it("uses no `/opacity` modifier, which escapes the remap entirely", () => {
    // `bg-brand-50/40` compiles to a class the `html.dark .bg-brand-50` rule cannot
    // match, so it paints a LIGHT block on the dark surface at 40% alpha.
    expect(TABLE).not.toMatch(/(?:bg|text|border)-(?:brand|gray)-\d+\//);
  });

  it("the GRID scrolls rather than compressing, with its first column pinned", () => {
    // Twelve audience columns do not fit a phone, and squeezing them would make every
    // figure unreadable rather than one swipe away. The name stays put so a workflow is
    // still identifiable halfway across.
    const at = TABLE.indexOf("function WorkflowMatrix(");
    const body = TABLE.slice(at, TABLE.indexOf("function ObliqueHeader(", at));
    expect(body).toContain('<div className="overflow-x-auto">');
    // 240px on a phone, 320px from `md`: the second line wants ~290px to sit on one
    // row, and a 320px sticky column on a 412px phone leaves 92px of grid.
    expect(body).toContain("sticky left-0 z-10 w-[240px] min-w-[240px] bg-white");
    expect((body.match(/md:w-\[320px\] md:min-w-\[320px\]/g) ?? []).length).toBe(2);
    expect((body.match(/sticky left-0 z-10/g) ?? []).length).toBe(2);
  });

  it("names what each workflow WRITES WITH under its name, since there is no column for it", () => {
    // Two rows of this channel routinely differ only in the model or the template, so
    // the names alone leave a reader unable to tell them apart. The guard pins the CALL
    // SITE: a component perfectly able to draw the line is the feature entirely absent
    // if the matrix never mounts it.
    const at = TABLE.indexOf("function WorkflowMatrix(");
    const body = TABLE.slice(at, TABLE.indexOf("function ObliqueHeader(", at));
    expect(body).toContain("<WorkflowStackLine");
    expect(body).toContain("contentModel={r.row.contentModel}");
    expect(body).toContain("contentPromptType={r.row.contentPromptType}");
  });

  it("that line states the IDS and wraps rather than truncating", () => {
    // The id is what the workflow STORES and what a reader quotes back to us; the label
    // is a derivation, and for a template it drops the VERSION that tells two apart. The
    // longest pair is wider than the column, so it wraps.
    const cells = read("src/components/workflows/workflow-cells.tsx");
    const at = cells.indexOf("export function WorkflowStackLine(");
    const body = cells.slice(at, cells.indexOf("export function WorkflowModelCell(", at));
    expect(body).toContain("{model.alias}");
    expect(body).toContain("{template.id}");
    expect(body).not.toContain("model.label");
    expect(body).not.toContain("template.label");
    expect(body).toContain("flex-wrap");
    expect(body).not.toContain("truncate");
    // Neither stated means nothing is drawn — never a row of dashes, which would read
    // as two facts we looked up and failed to find.
    expect(body).toContain("if (!model && !template) return null;");
    // An alias the catalogue does not know draws the neutral glyph, never a guessed logo.
    expect(body).toContain("model.providerDomain ? (");
  });

  it("the column heads are OBLIQUE, each with its own face", () => {
    const at = TABLE.indexOf("function ObliqueHeader(");
    const body = TABLE.slice(at, TABLE.indexOf("function MatrixCellTd(", at));
    expect(body).toContain("origin-bottom-left -rotate-45");
    expect(body).toContain("whitespace-nowrap");
    // A fixed height, or the rotated label clips into the row above it.
    expect(body).toContain("h-[140px]");
    expect(TABLE).toContain("<AudienceAvatar name={a.name} avatarUrl={a.avatarUrl} size={16} />");
  });
});

describe("the comparison bars read on the dark surface", () => {
  const globals = read("src/app/globals.css");
  it("the quiet fill has a dark remap", () => {
    expect(PANEL).toContain('"bg-gray-300"');
    expect(globals).toContain("html.dark .bg-gray-300 {");
  });
  it("a value the producer could not measure draws NO bar, never a zero-length one", () => {
    expect(PANEL).toContain("{r.value != null && (");
  });
});

describe("every query root is persisted", () => {
  for (const root of [
    "workflows",
    "workflowDynasties",
    "campaignWorkflowRevenue",
    "workflowRankLadder",
    "workflowRevenue",
    "fleetWorkflowCost",
  ]) {
    it(`${root} is allowlisted, so the surface paints from disk`, () => {
      expect(PERSIST).toContain(`"${root}",`);
    });
  }
});

describe("what is RUNNING is read from the ledger, not from the campaign row", () => {
  // campaign-service's `workflowSlug` is the workflow the campaign was CONFIGURED with
  // and is never rewritten when the selector switches. Prod 2026-09-14 on this very
  // campaign: the row said `…-rudder-v3`, a deprecated version that had never served a
  // lead there, while `…-lithium-v6` had served 2,439. The page badged Rudder.
  //
  // A page that reads the ledger block but never PASSES it is the feature entirely
  // absent with the lib perfectly correct, so these pin the CALL SITE, not the module.
  it("the running workflow comes off observedPicks", () => {
    const at = TABLE.indexOf("const running = useMemo(");
    expect(at).toBeGreaterThan(-1);
    const body = TABLE.slice(at, at + 600);
    expect(body).toContain("runningFromObservedPicks(ladderQ.data?.observedPicks)");
  });

  it("there is NO fallback to the configured workflow slug", () => {
    // The whole bug. `campaign?.workflowSlug` may not feed the badge on any branch.
    const at = TABLE.indexOf("const running = useMemo(");
    expect(TABLE.slice(at, at + 600)).not.toContain("workflowSlug");
    expect(TABLE).not.toContain("resolveRunningWorkflow");
  });

  it("the dynasty map is no longer read here, since nothing resolves a pinned slug", () => {
    // Deleting the fallback made this read dead; a dead poll on a customer surface is
    // a request nobody needs. The reader itself stays for the lead panel.
    expect(TABLE).not.toContain("listChannelWorkflowDynasties");
    expect(TABLE).not.toContain("dynastiesQ");
  });

  it("the audience mark is a SET over the window, never last.audienceId", () => {
    // One run fans across six audiences in 26 minutes, so a single mark picks one of
    // six arbitrarily. The columns with NO pick are what the mark distinguishes.
    const at = TABLE.indexOf("const ranAudienceIds = useMemo(");
    expect(at).toBeGreaterThan(-1);
    expect(TABLE.slice(at, at + 400)).toContain(
      "observedAudienceIds(ladderQ.data?.observedPicks)",
    );
    expect(TABLE).not.toContain("last.audienceId");
  });

  it("both surfaces that carry columns are handed the set", () => {
    const sidebar = TABLE.slice(TABLE.indexOf("<ScopeSidebar"), TABLE.indexOf("<WorkflowMatrix"));
    expect(sidebar).toContain("ranAudienceIds={ranAudienceIds}");
    const matrix = TABLE.slice(TABLE.indexOf("<WorkflowMatrix"));
    expect(matrix.slice(0, 500)).toContain("ranAudienceIds={ranAudienceIds}");
  });

  it("the column mark is drawn in both places", () => {
    expect(TABLE).toContain("ran={ranAudienceIds.has(a.audienceId)}");
    expect(TABLE).toContain("const ran = ranAudienceIds.has(a.audienceId);");
  });

  it("the cheapest-column pill no longer calls itself current", () => {
    // "Current best" conflated the price with the fact; a real current mark exists now.
    expect(TABLE).not.toContain("CURRENT_BEST_TIP");
    expect(TABLE).toContain("const BEST_TIP =");
  });

  it("the reader declares the block, so zod cannot strip it", () => {
    const body = sliceFn(API, "const WorkflowRankLadderSchema = z.object({");
    expect(body).toContain("observedPicks: z");
    // Nullish carries the producer's two absences; required would throw on a
    // funnel-keyed body and non-nullable would throw on an unreadable ledger.
    expect(body).toContain(".nullish()");
  });

  it("the reader asks for ONE feature, never the fleet", () => {
    // The unscoped listing is every internal workflow codename we have, and a codename
    // must never reach a customer's browser.
    const at = API.indexOf("export async function listChannelWorkflowDynasties");
    expect(at).toBeGreaterThan(-1);
    const body = API.slice(at, API.indexOf("\nexport ", at + 10));
    expect(body).toContain("URLSearchParams({ featureSlug })");
    expect(body).toContain("/workflows/dynasties?");
  });

  it("the reader fails loud on a shape it does not recognise", () => {
    const at = API.indexOf("export async function listChannelWorkflowDynasties");
    const body = API.slice(at, API.indexOf("\nexport ", at + 10));
    expect(body).toContain("safeParse");
    expect(body).toContain("throw new Error");
    expect(body).not.toContain("?? []");
  });

  it("the rank reader fails loud too", () => {
    const body = sliceFn(API, "export async function getWorkflowRankLadder(");
    expect(body).toContain("safeParse");
    expect(body).toContain("throw new Error");
  });
});

describe("the top bar still parses the old workflow route", () => {
  // The route redirects rather than 404ing, so the parser stays: a stale link renders
  // one frame of that path before the redirect lands.
  it("reads the segment rather than a hardcoded index at a call site", () => {
    expect(HEADER).toContain("workflowDynastySlug:");
    expect(HEADER).toContain('sixth === "workflows" && seventh');
  });
});

describe("the LLM and the Template are their own columns, from the wire", () => {
  it("does not parse a DAG to invent either", () => {
    // Both are workflow-service's to derive, and it does — re-deriving its answer from
    // its own internals is the workaround this repo forbids.
    expect(TABLE).not.toContain(".dag");
    expect(CELLS).not.toContain(".dag");
  });

  it("both surfaces render the SAME cells", () => {
    for (const [name, src] of [
      ["table", TABLE],
      ["panel", PANEL],
    ] as const) {
      expect(src, name).toContain("WorkflowModelCell");
      expect(src, name).toContain("WorkflowTemplateCell");
    }
  });
});

describe("a RETIRED workflow gets no row at all", () => {
  it("the rows are keyed on the CATALOGUE, never on the figures", () => {
    expect(TABLE).toContain("catalogue: catalogueQ.data ?? []");
    expect(TABLE).not.toContain("Retired");
  });
});

describe("no provider stack — the only logo on a row is the model's", () => {
  it("the table never draws requiredProviders", () => {
    // Every workflow of one channel calls the same lead database and the same sender,
    // so the stack distinguished nothing while attributing a customer's row to a vendor.
    expect(TABLE).not.toContain("requiredProviders");
    expect(PANEL).not.toContain("requiredProviders");
  });
});

describe("the outcome pair is the campaign's own LEG, never its funnel", () => {
  it("both surfaces resolve it through the ONE hook", () => {
    for (const [name, src] of [
      ["table", TABLE],
      ["panel", PANEL],
    ] as const) {
      expect(src, name).toContain("WorkflowOutcomePair");
    }
    expect(TABLE).toContain("useCampaignOutcomePair(campaign, featureSlug)");
  });

  it("the panel is HANDED the pair rather than resolving a second one", () => {
    // Two resolutions is how a row and the panel it opens come to name two different
    // outcomes for one campaign.
    expect(PANEL).not.toContain("useCampaignOutcomePair");
    expect(TABLE).toContain("pair={pair}");
  });

  it("the fleet read is priced on the pair's own objective", () => {
    for (const [name, src] of [
      ["table-panel", PANEL],
    ] as const) {
      expect(src, name).toContain("FLEET_OBJECTIVE_BY_PAIR");
      expect(src, name).toContain('reply: "positiveReply"');
      expect(src, name).toContain('visit: "websiteVisit"');
    }
  });

  it("the objective rides the fleet read's cache key", () => {
    expect(PANEL).toContain('["fleetWorkflowCost", featureSlug || "none", FLEET_OBJECTIVE_BY_PAIR[pair]]');
  });
});

describe("NOTHING in these components orders anything — both positions are served", () => {
  it("no `.sort(` at all in the workflows components", () => {
    // A page that ranked the rows it DISPLAYS is what produced the second, disagreeing
    // order: the recommended workflow sat 18th of 24 on a page whose heading said the
    // list was ranked the way we pick. If the rank looks wrong it is the producer's
    // answer that is wrong, and that is a far more useful thing to know.
    for (const [name, src] of [
      ["campaign-workflows-page", TABLE],
      ["workflow-rank-panel", PANEL],
      ["workflow-cells", CELLS],
    ] as const) {
      expect(src, name).not.toContain(".sort(");
    }
  });

  it("no cost or rank comparison is written by hand either", () => {
    for (const [name, src] of [
      ["campaign-workflows-page", TABLE],
      ["workflow-rank-panel", PANEL],
    ] as const) {
      // `a.cost - b.cost`, `x.rank - y.rank` and friends — the shape of a comparator.
      expect(src, name).not.toMatch(/\.(?:costPerOutcomeUsd|rank|scopeRank)\s*-\s*[a-z]/i);
    }
  });

  it("the two ordering modules sort on a SERVED position and never on a figure", () => {
    const matrix = read("src/lib/workflow-matrix.ts");
    const rank = read("src/lib/workflow-rank-why.ts");
    // `columnBestCells` READS a served position — it never compares two figures, so no
    // cost is sorted on, minimised or even mentioned in it.
    const best = matrix.slice(
      matrix.indexOf("export function columnBestCells("),
      matrix.indexOf("export function isColumnBestCell("),
    );
    expect(best).not.toContain(".sort(");
    expect(best).not.toContain("costPerOutcomeUsd");
    const order = rank.slice(
      rank.indexOf("const ordered = [...input.rows].sort("),
      rank.indexOf("const ranked = ordered.map("),
    );
    expect(order).not.toContain("costPerOutcomeUsd");
  });
});

describe("no em dash in anything a customer reads", () => {
  /** Comments use the em dash freely and must not trip a guard about COPY, so they go
   *  first — the same reason `pr-expert-public-report` ships its own stripper. */
  const stripComments = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/[^\n"'`]*$/gm, "");

  it("the sentences the ranking module writes carry none", () => {
    const rank = read("src/lib/workflow-rank-why.ts");
    const sentences = rank.slice(rank.indexOf("export function workflowRankWhy("));
    const literals = sentences.match(/`[^`]*`|"[^"]*"/g) ?? [];
    for (const lit of literals) expect(lit).not.toContain("—");
  });

  it("every tooltip and label on the grid carries none", () => {
    // The ONE exception is the null placeholder itself, which is the repo's own
    // spelling for "we have no figure" on every table it renders.
    for (const [name, src] of [
      ["campaign-workflows-page", TABLE],
      ["workflow-rank-panel", PANEL],
    ] as const) {
      const literals = stripComments(src).match(/`[^`]*`|"[^"]*"/g) ?? [];
      const offenders = literals.filter(
        (lit) => lit.includes("—") && lit.replace(/[`"]/g, "") !== "—",
      );
      expect(offenders, name).toEqual([]);
    }
  });
});
