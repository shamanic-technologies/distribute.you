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

  it("the BRAND grain has its own reader and its own key, never the campaign's", () => {
    const body = sliceFn(API, "export async function getBrandRevenueByWorkflow(");
    // Bounded to the function's own closing brace: `sliceFn` stops at the next
    // `export`, which drags in the NEXT reader's doc comment — and that comment
    // legitimately names `campaignId`, so an unbounded negative asserts nothing.
    const fn = body.slice(0, body.indexOf("\n}") + 2);
    expect(fn).toContain('new URLSearchParams({ brandId, groupBy: "workflow" })');
    expect(fn).not.toContain("campaignId");
    expect(body).toContain('query.set("pricing", "net")');
    expect(TABLE).toContain('["brandWorkflowRevenue", brandId]');
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
    expect(TABLE).toContain('w-[42%] md:w-[22%]');
  });

  it("gates the min-width at the SAME breakpoint the folded columns return", () => {
    // An unconditional floor re-widens the row on a phone and pushes the columns that
    // DO render off to the right, which reads as the data being missing.
    expect(TABLE).toContain("md:min-w-[1040px]");
    expect(TABLE).not.toContain('className="w-full min-w-[');
    // Four of the seven columns fold below `md`: LLM, Template, $ Invested, Outreach.
    // Each one appears twice — its header and its cell.
    expect((TABLE.match(/hidden md:table-cell/g) ?? []).length).toBe(8);
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
    "workflowDynasties",
    "campaignWorkflowRevenue",
    "brandWorkflowRevenue",
    "workflowRevenue",
    "fleetWorkflowCost",
    "fleetWorkflowOutreach",
  ]) {
    it(`${root} is allowlisted, so the surface paints from disk`, () => {
      expect(PERSIST).toContain(`"${root}",`);
    });
  }
});

describe("the channel's version-to-dynasty map reaches BOTH resolution call sites", () => {
  // The map is the only source that can name a SUPERSEDED version, which is what
  // campaign-service routinely pins a campaign to. A page that reads it but never
  // PASSES it is the feature entirely absent with the lib perfectly correct — so the
  // guard pins the call site, not the reader.
  for (const [name, src] of [
    ["the table", TABLE],
    ["the detail page", DETAIL],
  ] as const) {
    it(`${name} reads the map`, () => {
      expect(src).toContain("listChannelWorkflowDynasties");
      expect(src).toContain('["workflowDynasties", featureSlug ?? "none"]');
    });

    it(`${name} hands it to resolveRunningWorkflow`, () => {
      const at = src.indexOf("resolveRunningWorkflow(");
      expect(at).toBeGreaterThan(-1);
      const call = src.slice(at, src.indexOf("isLearning", at) + 40 || at + 600);
      expect(call).toContain("dynastiesQ.data ?? []");
    });

    it(`${name} re-resolves when the map arrives`, () => {
      // Without the dep the memo keeps the pre-map answer for the life of the mount,
      // so the section stays missing until something unrelated invalidates it.
      const at = src.indexOf("resolveRunningWorkflow(");
      expect(src.slice(at, at + 900)).toContain("dynastiesQ.data,");
    });
  }

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

describe("the LLM and the Template are their own columns, from the wire", () => {
  it("does not parse a DAG to invent either", () => {
    // Both are workflow-service's to derive, and it does (v0.45.7) — re-deriving its
    // answer from its own internals is the workaround this repo forbids, and it is a
    // different thing from reading the fields it publishes.
    expect(TABLE).not.toContain(".dag");
    expect(DETAIL).not.toContain(".dag");
    expect(CELLS).not.toContain(".dag");
    const body = sliceFn(API, "export async function listChannelWorkflows(");
    expect(body).not.toContain("dag");
  });

  it("the table gives each of them a column of its own", () => {
    expect(TABLE).toContain("<WorkflowModelCell contentModel={row.contentModel} />");
    expect(TABLE).toContain(
      "<WorkflowTemplateCell contentPromptType={row.contentPromptType} />",
    );
  });

  it("the MODEL cell draws through the one marks catalogue, logo led by its domain", () => {
    expect(CELLS).toContain("workflowModelMark(contentModel)");
    expect(CELLS).toContain("domain={model.providerDomain}");
    // An alias the catalogue does not know keeps its own text and draws no logo — the
    // catalogue decides that, so the cell must not second-guess it from the label or
    // the alias, which is how a wrong company's logo lands beside a customer's spend.
    expect(CELLS).not.toContain("domain={model.label");
    expect(CELLS).not.toContain("domain={model.alias");
  });

  it("the MODEL cell states the alias verbatim as its second line", () => {
    expect(CELLS).toContain("line2={known ? model.alias : null}");
  });

  it("the TEMPLATE cell names it from the id and prints the id verbatim under it", () => {
    expect(CELLS).toContain("workflowTemplateLabel(contentPromptType)");
    expect(CELLS).toContain("line1={template.label}");
    expect(CELLS).toContain("line2={template.id}");
  });

  it("a thing with no model and no template reads a dash, never a default", () => {
    expect((CELLS.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("the template tile rotates to the BRAND's tertiary rather than staying ours", () => {
    // `tone-tile` is what makes the orange follow the customer's own hue; without it
    // the tile is the one control on the page that stays our colour.
    expect(CELLS).toContain("tone-tile bg-orange-50 text-orange-600");
  });

  it("states them on the DETAIL header too, through the SAME cells", () => {
    // A guard pinned to the component and not to the call site passes while the page
    // renders nothing — so this reads the page, where the header is assembled.
    expect(DETAIL).toContain("<WorkflowModelCell contentModel={row?.contentModel ?? null} />");
    expect(DETAIL).toContain(
      "<WorkflowTemplateCell contentPromptType={row?.contentPromptType ?? null} />",
    );
  });
});

describe("a RETIRED workflow gets no row at all", () => {
  it("neither page renders the word, and the model no longer carries the flag", () => {
    const MODEL = read("src/lib/campaign-workflow-rows.ts");
    for (const src of [TABLE, DETAIL]) {
      expect(src).not.toContain("row.retired");
      expect(src).not.toContain("row?.retired");
    }
    expect(MODEL).not.toContain("retired:");
  });
});

describe("no provider stack — the only logo on a row is the model's", () => {
  it("the requiredProviders stack is GONE from the reader and from both pages", () => {
    // Every workflow of one channel calls the same lead database and the same sender,
    // so the stack distinguished nothing while attributing a customer's row to Apollo
    // and Anthropic.
    expect(API).not.toContain("requiredProviders: z");
    for (const src of [TABLE, DETAIL]) {
      expect(src).not.toContain("row.providers");
      expect(src).not.toContain("row?.providers");
    }
    const MODEL = read("src/lib/campaign-workflow-rows.ts");
    expect(MODEL).not.toContain("dedupeProviders");
  });
});

describe("THREE sections, and the running workflow sits in exactly one of them", () => {
  it("the page renders each section off the shared model, never a local sort", () => {
    expect(TABLE).toContain("sectionCampaignWorkflowRows(rows)");
    for (const title of ["Running now", "Measured", "Not measured yet"]) {
      expect(TABLE).toContain(`title="${title}"`);
    }
    expect(TABLE).toContain("rows={sections.running}");
    expect(TABLE).toContain("rows={sections.measured}");
    expect(TABLE).toContain("rows={sections.notMeasured}");
  });

  it("only the running section is framed in the brand primary", () => {
    expect(TABLE).toContain('running ? "border-brand-200" : "border-gray-200"');
  });
});

describe("the grain is a TAB, and no tab falls back to another one's answer", () => {
  it("offers all four grains and defaults to the campaign", () => {
    expect(TABLE).toContain('useState<WorkflowGrain>("campaign")');
    for (const label of ["Campaign", "Offer", "Brand", "Global"]) {
      expect(TABLE).toContain(`label: "${label}"`);
    }
  });

  it("the offer tab is WIRED — no tab is disabled and none says coming soon", () => {
    // It shipped disabled because features-service did not honour `offerId` on the
    // grouped read; #923 -> v0.162.1 does, proven on the wire against a brand whose
    // offer scope genuinely differs from its brand scope (31 dynasties vs 28), so the
    // gate and the sentence explaining it both go. A disabled tab left behind a live
    // producer is a capability reported as missing.
    expect(TABLE).not.toContain('const disabled = g.key === "offer"');
    expect(TABLE).not.toContain("OFFER_SOON_TIP");
    expect(TABLE).not.toContain("Coming soon.");
    expect(TABLE).not.toContain("disabled={disabled}");
  });

  it("the offer grain sends offerId, under its own key, and never the brand's body", () => {
    // Bounded to the NEXT declaration rather than a measured length: a `toContain`
    // cannot be hurt by an over-long slice, and a number expires on the next comment.
    const at = TABLE.indexOf("  const offerRevQ = useAuthQuery(");
    expect(at).toBeGreaterThan(-1);
    const body = TABLE.slice(at, TABLE.indexOf("  const brandRevQ = useAuthQuery(", at));
    expect(body).toContain('["offerWorkflowRevenue", brandId, offerId]');
    expect(body).toContain("getOfferRevenueByWorkflow(featureSlug as string, brandId, offerId)");
    expect(body).toContain('grain === "offer"');
    // The reader is the one that states the grain; the page never borrows a sibling's.
    expect(TABLE).not.toContain('grain === "offer" ? brandRevQ.data');
    // Bounded to its own closing brace, for the reason the brand guard above spells
    // out: `sliceFn` stops at the next `export`, dragging in the NEXT reader's doc
    // comment, which legitimately names `campaignId`.
    const slice = sliceFn(API, "export async function getOfferRevenueByWorkflow(");
    const reader = slice.slice(0, slice.indexOf("\n}") + 2);
    expect(reader).toContain('new URLSearchParams({ brandId, offerId, groupBy: "workflow" })');
    expect(reader).toContain('query.set("pricing", "net")');
    // `offerId` beside `campaignId` is a 400 — the two are never sent together.
    expect(reader).not.toContain("campaignId");
  });

  it("each grain sends its OWN read, gated on the tab", () => {
    expect(TABLE).toContain('grain === "campaign"');
    expect(TABLE).toContain('grain === "offer"');
    expect(TABLE).toContain('grain === "brand"');
    expect(TABLE).toContain('grain === "global"');
  });

  it("the GLOBAL grain joins the two public cross-org reads", () => {
    expect(TABLE).toContain("getFleetWorkflowCost(featureSlug as string, FLEET_OBJECTIVE)");
    expect(TABLE).toContain("getFleetWorkflowOutreach(featureSlug as string)");
    expect(TABLE).toContain("buildFleetWorkflowRows({");
  });

  it("the fleet outreach reader counts PEOPLE, never runs", () => {
    const body = sliceFn(API, "export async function getFleetWorkflowOutreach(");
    expect(body).toContain("recipientsContacted");
    expect(body).not.toContain("completedRuns");
    // The endpoint defaults to the top 3, so the ceiling has to be stated.
    expect(body).toContain('limit: String(limit)');
  });

  it("the global grain states its own basis rather than charting it as ours", () => {
    expect(TABLE).toContain("including spend we later refunded");
  });

  it("the running workflow is resolved ONCE and handed to every grain's builder", () => {
    // A campaign pinned to anything but its dynasty's CURRENT version is nameable only
    // by a revenue group's folded `workflowSlugs`, and the global grain holds no groups
    // — so a builder resolving from its own source lost `Running now` on that tab alone.
    // The page must resolve from the catalogue AND every group set it holds, once.
    const call = TABLE.slice(
      TABLE.indexOf("resolveRunningWorkflow("),
      TABLE.indexOf("const rows = useMemo("),
    );
    expect(call).toContain("campaign?.workflowSlug ?? null");
    expect(call).toContain("catalogueQ.data ?? []");
    expect(call).toContain("campaignRevQ.data ?? []");
    expect(call).toContain("offerRevQ.data ?? []");
    expect(call).toContain("brandRevQ.data ?? []");
    // Neither builder may be handed the raw slug again — that is the per-grain
    // resolution this replaced.
    expect(TABLE).not.toContain("campaignWorkflowSlug");
    expect(DETAIL).not.toContain("campaignWorkflowSlug");
    expect(DETAIL).toContain("resolveRunningWorkflow(");
    expect(
      DETAIL.slice(DETAIL.indexOf("resolveRunningWorkflow("), DETAIL.indexOf("isLearning,")),
    ).toContain("campaign?.workflowSlug ?? null");
  });

  it("only the CAMPAIGN grain can say a scope is paused", () => {
    // At brand and global grain the scope spans campaigns, so the word describes none
    // of them.
    expect(TABLE).toContain('grain === "campaign" && campaignPaused');
  });
});
