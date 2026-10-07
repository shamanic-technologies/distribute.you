import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("dashboard v2 Workflows: staff mode only, no badge", () => {
  it("the campaign Workflows tab is offered in staff mode only, untagged", () => {
    const page = read("src/components/v2/campaign-page.tsx");
    const tabs = page.slice(page.indexOf("const CAMPAIGN_TABS"), page.indexOf("];", page.indexOf("const CAMPAIGN_TABS")));
    expect(tabs).toContain('label: "Workflows"');
    expect(tabs).not.toContain("isBeta");
    expect(tabs).not.toContain("badge:");
    expect(page).toContain("!t.staff || staffMode");
  });

  it("the sidebar entry is staff mode only and untagged", () => {
    const shell = read("src/components/v2/v2-shell.tsx");
    const entry = shell.indexOf('label="Workflows"');
    expect(entry).toBeGreaterThan(-1);
    expect(shell.slice(shell.lastIndexOf("{staffMode && (", entry), entry)).toContain("<NavItem");
    expect(shell).not.toContain("isBeta");
    expect(shell).not.toContain("MaturityBadge");
  });

  it("both pages exist, behind staff mode (StaffOnly on the route), never the beta list", () => {
    const base = "src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/workflows";
    expect(existsSync(resolve(ROOT, `${base}/page.tsx`))).toBe(true);
    expect(existsSync(resolve(ROOT, `${base}/[workflowSlug]/page.tsx`))).toBe(true);
    for (const f of ["src/components/v2/workflows-page.tsx", "src/components/v2/workflow-page.tsx"]) {
      const src = read(f);
      expect(src, f).not.toContain("useIsBetaUser");
      expect(src, f).not.toContain("This page is still in beta");
    }
  });

  it("a row is a workflow for ONE crew, and its page carries the crew in the URL", () => {
    expect(read("src/components/v2/workflows-page.tsx")).toContain("crewParam(spec)");
    expect(read("src/lib/v2/routes.ts")).toContain("?crew=${encodeURIComponent(crew)}");
  });

  it("a staff-gated surface has its own label, distinct from beta", () => {
    const gates = read("src/lib/feature-gates.ts");
    expect(gates).toContain('"alpha" | "beta" | "staff"');
    expect(gates).toContain("staff: ");
  });
});

describe("editing a workflow's prompt is STAFF-only, and says who it affects", () => {
  const page = read("src/components/v2/workflow-page.tsx");
  const card = page.slice(page.indexOf("function PromptCard("), page.indexOf("// ─── Past runs"));

  it("the Edit control is offered in staff mode only, untagged", () => {
    expect(card).toContain("const { staffMode: isStaff } = useStaffMode();");
    expect(card).toContain("isStaff && !editing");
    expect(card).not.toContain('level="staff"');
  });

  it("Fork and Upgrade each confirm first, stating the blast radius", () => {
    expect(card).toContain('onClick={() => setConfirm("fork")}');
    expect(card).toContain('onClick={() => setConfirm("upgrade")}');
    expect(card).toContain("UPGRADE_WARNING");
    expect(card).toContain("FORK_WARNING");
    expect(page).toContain("for every brand");
  });

  it("a refusal renders the producer's sentence, never the thrown message", () => {
    expect(card).toContain("err.body?.error");
    expect(card).not.toContain("err.message");
  });

  it("the write goes through the gateway's dynasty route", () => {
    expect(read("src/lib/api.ts")).toContain("/workflows/dynasty/${encodeURIComponent(workflowDynastySlug)}/prompt-edit");
  });
});

describe("the Actual cost basis is STAFF-only", () => {
  const page = read("src/components/v2/workflow-page.tsx");
  const over = page.slice(page.indexOf("function OverTime("), page.indexOf("function ChartCard("));

  it("the toggle renders in staff mode only, untagged, and defaults to User cost", () => {
    // ONE switch for every cost page, in the top bar (components/v2/cost-basis-switch.tsx).
    const sw = read("src/components/v2/cost-basis-switch.tsx");
    expect(sw).toContain("if (!isStaff) return null;");
    expect(sw).not.toContain('level="staff"');
    const hook = read("src/lib/v2/use-cost-basis.ts");
    expect(hook).toContain('const basis: CostBasis = isStaff ? stored : "user";');
    expect(hook).toContain('const readServer = (): CostBasis => "user";');
    // the cost basis switch leads the top bar's actions, the staff Mature/Flash switch beside it
    expect(page).toContain("<CostBasisSwitch />\n            <StatBasisSwitch />");
  });

  it("the actual read fires only for staff on the actual basis", () => {
    expect(over).toContain("const { actual } = useCostBasis();");
    expect(over).toContain("enabled: actual");
  });

  it("a day with no known vendor cost is left out, never filled with the billed figure", () => {
    expect(over).toContain("points.filter((p) => p.spend != null)");
    expect(read("src/lib/api.ts")).toContain("cumulativeSpendUsd: z.coerce.number().nullable()");
  });
});

describe("the ranking is asked per MISSION, and the pages speak v2", () => {
  const data = read("src/components/v2/workflows-data.ts");
  const list = read("src/components/v2/workflows-page.tsx");
  const page = read("src/components/v2/workflow-page.tsx");

  it("the ladder is asked with the mission's campaign, on the campaign Workflows page's own key", () => {
    // A leg-keyed ranking with no campaign 409s on a brand selling several offers.
    // On the billed basis the key is the billed one; the staff Actual basis reads its own
    // (never-persisted) root, so the two bases never share a cache entry.
    expect(data).toContain('[actual ? "workflowRankLadderActual" : "workflowRankLadder", brandId, legKey ?? "none", campaignId ?? "none"]');
    expect(data).toContain("leg: legKey, campaignId, actual }");
    expect(read("src/components/workflows/campaign-workflows-page.tsx")).toContain('["workflowRankLadder", brandId, legKey ?? "none", campaignId]');
  });

  it("a workflow link names the mission, and an older crew-only link still resolves on a single mission", () => {
    expect(read("src/lib/v2/routes.ts")).toContain("&mission=${encodeURIComponent(mission)}");
    expect(list).toContain("crewParam(spec), spec.campaignId)");
    expect(page).toContain("!missionRaw && crewSpecs.length === 1");
  });

  it("neither page imports v1 layout or v1 greys", () => {
    for (const src of [list, page]) {
      expect(src).not.toMatch(/WorkflowRankPanel|WorkflowStackLine|InfoTooltip|V2Page/);
      expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl|bg-black\//);
    }
  });

  it("layers portal to the v2 layer and close on Esc", () => {
    expect(page).toContain('document.getElementById("v2-portal")');
    expect(page).toContain('e.key === "Escape"');
  });
});

describe("v2 workflows: one reading per figure, and runs that say who they wrote to", () => {
  const list = read("src/components/v2/workflows-page.tsx");
  const page = read("src/components/v2/workflow-page.tsx");

  it("shows no 'Our pick' tag: the producer's #1 is scored on cells no column shows", () => {
    expect(list).not.toContain(">Our pick<");
    expect(page).not.toContain(">Our pick<");
  });

  it("reads the Offer column off the SAME ladder as Brand, never the realized grouped revenue (features-service#1172)", () => {
    expect(list).toContain(">Offer</th>");
    // each grain states the price features-service holds for it on the page's basis (#1241)
    expect(list).toContain('offer: price("offer")');
    // The mature-cohort grouped revenue is a different basis: beside a ladder grain it printed a
    // different number for the same scope on a one-offer brand.
    expect(list).not.toContain("getOfferRevenueByWorkflow(");
  });

  it("states measured and projected in ONE cell, each named, never as a bare 'Est. return'", () => {
    expect(page).not.toContain('label="Est. return"');
    const strip = page.slice(page.indexOf('label="Return, this mission"'), page.indexOf("<p className=\"k-fg3 mt-2 text-[12px]\">"));
    // measured: the MATURE half of the served pair, Learning where the producer says so
    expect(strip).toContain('formatRoi(roi.value, "—")');
    expect(strip).toContain("formatRoi(ranked.ladder?.roiMultiple");
    expect(strip).toContain("fmtUsd(ranked.estCostPerOutcomeUsd)");
    expect(strip).toContain("ranked.estLearning ?");
    const dual = page.slice(page.indexOf("function DualKpi("), page.indexOf("function Row("));
    expect(dual).toContain(">measured<");
    expect(dual).toContain(">projected<");
    expect(page).toContain('title="Return on spend"');
  });

  it("names each run's lead on the drawer's own key, and a run that wrote nothing does not open", () => {
    const line = page.slice(page.indexOf("function RunLine("), page.indexOf("function durationLabel("));
    expect(line).toContain('["runEmails", brandId, run.id]');
    expect(line).toContain("Nobody to write to");
    expect(line).toContain("onClick={wroteNothing ? undefined : onOpen}");
  });

  it("has a v2 loading boundary so a row click paints at once", () => {
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/loading.tsx")).toContain("export default function V2BrandLoading");
  });
});

describe("v2 Workflows states the LLM and the template in their own columns", () => {
  const list = read("src/components/v2/workflows-page.tsx");
  it("has LLM and Template headers and no combined stack line", () => {
    expect(list).toContain("<th className={`${TH} w-40`}>LLM</th>");
    expect(list).toContain("<th className={`${TH} w-40`}>Template</th>");
    expect(list).not.toContain("const stack =");
  });
});
