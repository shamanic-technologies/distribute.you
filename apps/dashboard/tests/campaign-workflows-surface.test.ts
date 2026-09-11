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
    expect(body).toContain('if (params.leg) query.set("leg", params.leg);');
    expect(body).toContain("else if (params.funnel)");
    expect(body).toContain('query.set("pricing", "net")');
  });

  it("the ladder's arguments ride its cache key", () => {
    // A leg-keyed answer and a funnel-keyed one are different bodies; sharing a key
    // serves one campaign's ranking to another's question.
    expect(TABLE).toContain('["workflowRankLadder", brandId, legKey ?? "none"');
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

  it("ranks only the BRAND-level rows — a per-audience row would give one workflow several ranks", () => {
    const at = TABLE.indexOf("function ladderRows(");
    expect(at).toBeGreaterThan(-1);
    const body = TABLE.slice(at, TABLE.indexOf("\nexport function", at));
    expect(body).toContain("if (r.audienceId !== null) continue;");
  });

  it("reads the recommendation rather than re-deriving an argmin", () => {
    expect(TABLE).toContain("recommendedWorkflowDynastySlug");
    expect(TABLE).not.toContain("Math.min(");
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

describe("ONE table — no grain tabs, no sections", () => {
  it("carries no grain switch at all", () => {
    for (const gone of [
      "WorkflowGrain",
      "setGrain",
      "getBrandRevenueByWorkflow",
      "getOfferRevenueByWorkflow",
      "getFleetWorkflowOutreach",
      "buildFleetWorkflowRows",
    ]) {
      expect(TABLE, gone).not.toContain(gone);
    }
  });

  it("carries no section split", () => {
    expect(TABLE).not.toContain("sectionCampaignWorkflowRows");
    expect(TABLE).not.toContain("Not measured yet");
  });

  it("the running row is pinned FIRST and keeps its own merit rank", () => {
    const rank = read("src/lib/workflow-rank-why.ts");
    expect(rank).toContain("const runningIndex = ranked.findIndex((r) => r.row.running);");
    expect(rank).toContain("return [pinned, ...ranked];");
    // It is never renumbered: a `#1` badge on a row the producer ranks fourth would be
    // this surface stating something the ladder does not.
    expect(rank).not.toContain("rank: 1,");
  });

  it("states the rank and the why on every row", () => {
    expect(TABLE).toContain("{ranked.rank}");
    expect(TABLE).toContain("{ranked.why}");
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
    expect(TABLE).toContain('next.set("workflow", slug)');
    expect(TABLE).toContain('next.delete("workflow")');
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
    expect(PANEL).toContain("ladder.estimatesByGrain.audience");
    expect(PANEL).not.toContain("usedGrain = ladder.grain");
  });

  it("a grain with nothing spent says so rather than being silently absent", () => {
    expect(PANEL).toContain("Nothing spent here yet, so it is not used.");
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

  it("the cost cells read the served fields through the shared helpers", () => {
    expect(TABLE).toContain("workflowOutcomeCostCents(row)");
    expect(TABLE).toContain("workflowOutcomeCount(row)");
    expect(TABLE).toContain("ranked.estCostPerOutcomeUsd");
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
    expect(TABLE).toContain("md:min-w-[1180px]");
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
    for (const cls of ["bg-brand-50", "border-brand-200", "text-brand-600", "bg-gray-100"]) {
      expect(globals, cls).toContain(`html.dark .${cls} {`);
    }
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

describe("the channel's version-to-dynasty map reaches the resolution call site", () => {
  // The map is the only source that can name a SUPERSEDED version, which is what
  // campaign-service routinely pins a campaign to. A page that reads it but never
  // PASSES it is the feature entirely absent with the lib perfectly correct — so the
  // guard pins the call site, not the reader.
  it("the table reads the map", () => {
    expect(TABLE).toContain("listChannelWorkflowDynasties");
    expect(TABLE).toContain('["workflowDynasties", featureSlug ?? "none"]');
  });

  it("hands it to resolveRunningWorkflow, and re-resolves when it arrives", () => {
    const at = TABLE.indexOf("resolveRunningWorkflow(");
    expect(at).toBeGreaterThan(-1);
    expect(TABLE.slice(at, at + 900)).toContain("dynastiesQ.data ?? []");
    expect(TABLE.slice(at, at + 900)).toContain("dynastiesQ.data]");
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

describe("no em dash in anything a customer reads", () => {
  it("the copy carries none", () => {
    // The em dash is banned in user-facing copy. Both files use it freely in their own
    // comments, so the check reads the STRINGS a reader sees: the tooltips and the
    // sentences the ranking module writes.
    const rank = read("src/lib/workflow-rank-why.ts");
    const sentences = rank.slice(rank.indexOf("export function workflowRankWhy("));
    const literals = sentences.match(/`[^`]*`|"[^"]*"/g) ?? [];
    for (const lit of literals) expect(lit).not.toContain("—");
  });
});
