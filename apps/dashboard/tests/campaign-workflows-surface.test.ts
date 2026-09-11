/**
 * The campaign Workflows surface: the CALL SITES, not only the components.
 *
 * A component perfectly able to scope itself to a campaign is the feature entirely
 * absent if the page never passes the campaign — the threaded-prop trap this repo
 * keeps recording. So these guards read what the pages and the sidebar actually DO.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

const TABLE = read("src/components/workflows/campaign-workflows-page.tsx");
const DETAIL = read("src/components/workflows/campaign-workflow-detail-page.tsx");
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
    expect(DETAIL).not.toContain("useFeatureFlag");
  });

  it("both page bodies refuse a non-beta viewer", () => {
    for (const src of [TABLE, DETAIL]) {
      expect(src).toContain("useIsBetaUser");
      expect(src).toContain("Not available");
    }
  });

  it("both pages carry a visible beta badge", () => {
    for (const src of [TABLE, DETAIL]) {
      expect(src).toContain('<MaturityBadge level="beta" />');
    }
  });
});

describe("the channel is the CAMPAIGN's own", () => {
  it("neither page reads the brand's sole feature", () => {
    for (const src of [TABLE, DETAIL]) {
      expect(src).toContain("useScopedFeatureSlug(campaignId)");
      expect(src).not.toContain("useSoleFeatureSlug");
    }
  });
});

describe("every money read is CAMPAIGN-scoped and net", () => {
  it("the grouped reader sends the campaign — not just the brand", () => {
    const body = sliceFn(API, "export async function getFeatureRevenueByWorkflow(");
    expect(body).toContain('new URLSearchParams({ brandId, campaignId, groupBy: "workflow" })');
    expect(body).toContain('query.set("pricing", "net")');
  });

  it("the drill-down reader sends the campaign AND the dynasty", () => {
    const body = sliceFn(API, "export async function getWorkflowRevenue(");
    expect(body).toContain("brandId, campaignId, workflow: workflowDynastySlug");
    expect(body).toContain('query.set("pricing", "net")');
  });

  it("the grouped cache key carries the campaign, so a brand entry cannot serve it", () => {
    for (const src of [TABLE, DETAIL]) {
      expect(src).toContain('["campaignWorkflowRevenue", brandId, campaignId]');
    }
  });

  it("the drill-down key carries the dynasty as well", () => {
    expect(DETAIL).toContain('["workflowRevenue", brandId, campaignId, dynastySlug]');
  });

  it("the pages CALL the campaign-scoped reader with the campaign", () => {
    for (const src of [TABLE, DETAIL]) {
      expect(src).toContain(
        "getFeatureRevenueByWorkflow(featureSlug as string, brandId, campaignId)",
      );
    }
  });
});

describe("nothing is computed in the browser", () => {
  it("neither page divides spend by an outcome count", () => {
    for (const src of [TABLE, DETAIL]) {
      // The producer serves `cpprCents` and `conversionFromPreviousPct`; re-deriving
      // either drifts from it the moment a scope changes.
      expect(src).not.toMatch(/committedCostUsd\s*\/\s*/);
      expect(src).not.toMatch(/cpprCents\s*=\s*[^;]*\//);
      expect(src).not.toMatch(/recipientsRepliesPositive\s*\/\s*/);
    }
  });

  it("the drill-down renders the SERVED conversion rate", () => {
    expect(DETAIL).toContain("conversionFromPreviousPct");
  });
});

describe("a figure the producer could not measure reads as absent, never zero", () => {
  it("the table's formatters answer with a dash on null", () => {
    expect(TABLE).toContain('return value === null ? "—"');
  });
  it("the drill-down's do too", () => {
    expect(DETAIL).toContain('return value == null ? "—"');
  });
});

describe("the learning bar is the repo's ONE bar", () => {
  it("both pages read `isLearning` rather than a local threshold", () => {
    for (const src of [TABLE, DETAIL]) {
      expect(src).toContain('from "@/lib/learning-threshold"');
      expect(src).not.toMatch(/<\s*10\b/);
    }
  });

  it("a stopped campaign's tag reads Paused, off the shared derivation", () => {
    for (const src of [TABLE, DETAIL]) {
      expect(src).toContain("useScopePaused(brandId, { campaignId");
      expect(src).toContain("<LearningTag paused={paused} />");
    }
  });
});

describe("reveal on SETTLE — an errored read paints its state, never a skeleton forever", () => {
  it("every gate pairs isPending with isError", () => {
    for (const src of [TABLE, DETAIL]) {
      const gates = src.match(/\w+Q\.isPending && !\w+Q\.isError/g) ?? [];
      expect(gates.length).toBeGreaterThan(0);
    }
  });
});

describe("the fleet comparison states its own basis", () => {
  it("the drill-down names the different question rather than charting one series", () => {
    expect(DETAIL).toContain("FLEET_TIP");
    expect(DETAIL).toContain("including anything we later refunded");
  });
});

/**
 * What the RENDER caught, pinned so it cannot come back. Each of these was invisible
 * to `tsc` and to every other guard: the components were correct in isolation and the
 * suite was green while the page was visibly broken on a phone and on the dark theme.
 * Measured with the app's own compiled Tailwind + Playwright at 1280 and on a Pixel 7.
 */
describe("the table survives a phone and the dark theme", () => {
  it("bounds the identity cell so a long name can truncate", () => {
    // `truncate` does NOTHING under `table-auto`: the column sizes to its content, so
    // one long dynasty name widened the row and the wrapper scrolled sideways (752px
    // inside 378). Measured 378/378 after.
    expect(TABLE).toContain("table-fixed md:table-auto");
    expect(TABLE).toContain('w-[46%] md:w-[40%]');
  });

  it("gates the min-width at the SAME breakpoint the folded columns return", () => {
    // An unconditional floor re-widens the row on a phone and pushes the columns that
    // DO render off to the right, which reads as the data being missing.
    expect(TABLE).toContain("md:min-w-[820px]");
    expect(TABLE).not.toContain('className="w-full min-w-[');
    expect((TABLE.match(/hidden md:table-cell/g) ?? []).length).toBe(4);
  });

  it("lets the identity row WRAP, or the pill squeezes the name to zero width", () => {
    // Measured on a Pixel 7: the name rendered at 0px and the row showed a "Running
    // now" badge with no workflow at all. 39px after.
    expect(TABLE).toContain("flex min-w-0 flex-wrap items-center");
  });

  it("tints the running row with a class the dark remap can match", () => {
    // `bg-brand-50/40` compiles past `html.dark .bg-brand-50`, so the row painted a
    // LIGHT block on the dark surface (measured `oklab(0.97 … / 0.4)`).
    expect(TABLE).not.toContain("bg-brand-50/");
    expect(TABLE).toContain('row.running ? "bg-brand-50" : ""');
  });
});

describe("the comparison bars read on the dark surface", () => {
  const globals = read("src/app/globals.css");
  it("the quiet fill has a dark remap, added with the surface that needed it", () => {
    expect(DETAIL).toContain('"bg-gray-300"');
    expect(globals).toContain("html.dark .bg-gray-300 {");
  });
  it("a value the producer could not measure draws NO bar, never a zero-length one", () => {
    expect(DETAIL).toContain("{r.value != null && (");
  });
});

describe("every new query root is persisted", () => {
  for (const root of [
    "workflows",
    "campaignWorkflowRevenue",
    "workflowRevenue",
    "fleetWorkflowCost",
  ]) {
    it(`${root} is allowlisted, so the surface paints from disk`, () => {
      expect(PERSIST).toContain(`"${root}",`);
    });
  }
});

describe("the top bar names the open workflow", () => {
  it("the route parser reads the segment rather than a hardcoded index at a call site", () => {
    expect(HEADER).toContain("workflowDynastySlug:");
    expect(HEADER).toContain('sixth === "workflows" && seventh');
  });

  it("the crumb's label comes from the catalogue, on the key the table already polls", () => {
    expect(HEADER).toContain('["workflows", campaignFeatureSlug ?? "none"]');
    expect(HEADER).toContain("listChannelWorkflows");
  });

  it("the workflow crumb is where you are, so it is not a link", () => {
    const at = HEADER.indexOf("route.workflowDynastySlug !== null && (");
    expect(at).toBeGreaterThan(-1);
    const block = HEADER.slice(at, HEADER.indexOf("</nav>", at));
    expect(block).toContain('aria-current="page"');
    expect(block).not.toContain("<Link");
  });
});

describe("the identity cell states the model and the template, from the wire", () => {
  it("does not parse a DAG to invent either", () => {
    // Both are workflow-service's to derive, and it does (v0.45.7) — re-deriving its
    // answer from its own internals is the workaround this repo forbids, and it is a
    // different thing from reading the fields it publishes.
    expect(TABLE).not.toContain(".dag");
    expect(DETAIL).not.toContain(".dag");
    const body = sliceFn(API, "export async function listChannelWorkflows(");
    expect(body).not.toContain("dag");
  });

  it("draws the MODEL through the one marks catalogue, logo led by its domain", () => {
    const cell = sliceFn(TABLE, "export function WorkflowIdentity(");
    expect(cell).toContain("workflowModelMark(row.contentModel)");
    expect(cell).toMatch(/domain=\{model\??\.providerDomain/);
    // An alias the catalogue does not know keeps its own text and draws no logo — the
    // catalogue decides that, so the cell must not second-guess it from the label or
    // the alias, which is how a wrong company's logo lands beside a customer's spend.
    expect(cell).not.toContain("domain={model.label");
    expect(cell).not.toContain("domain={model.alias");
  });

  it("prints the TEMPLATE verbatim, and a dash when there is no model", () => {
    const cell = sliceFn(TABLE, "export function WorkflowIdentity(");
    expect(cell).toContain("{row.contentPromptType}");
    expect(cell).toContain("—");
  });

  it("states them on the DETAIL header too, not only in the table", () => {
    // A guard pinned to the component and not to the call site passes while the page
    // renders nothing — so this reads the page, where the header is assembled.
    expect(DETAIL).toContain("workflowModelMark(row?.contentModel)");
    expect(DETAIL).toContain("{row.contentPromptType}");
  });
});
