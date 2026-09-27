import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("dashboard v2 Workflows: beta, with its own badge", () => {
  it("the mission Workflows tab is offered only to the beta list, badged", () => {
    const setup = read("src/components/v2/setup-pages.tsx");
    const fn = setup.slice(setup.indexOf("export function missionTabs("), setup.indexOf("export function V2MissionSettingsPage("));
    expect(fn).toContain("if (isBeta) tabs.push(");
    expect(fn).toContain('badge: "beta"');
    expect(read("src/components/v2/mission-page.tsx")).toContain('"overview", isBeta)');
  });

  it("the sidebar entry sits under Missions, beta-gated and badged", () => {
    const shell = read("src/components/v2/v2-shell.tsx");
    const missions = shell.indexOf('label="Missions"');
    const entry = shell.indexOf('label="Workflows"');
    expect(missions).toBeGreaterThan(-1);
    expect(entry).toBeGreaterThan(missions);
    expect(shell.slice(shell.lastIndexOf("{isBeta && (", entry), entry)).toContain("<NavItem");
  });

  it("both pages exist and gate their bodies on the same list", () => {
    const base = "src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/workflows";
    expect(existsSync(resolve(ROOT, `${base}/page.tsx`))).toBe(true);
    expect(existsSync(resolve(ROOT, `${base}/[workflowSlug]/page.tsx`))).toBe(true);
    for (const f of ["src/components/v2/workflows-page.tsx", "src/components/v2/workflow-page.tsx"]) {
      const src = read(f);
      expect(src, f).toContain("useIsBetaUser()");
      expect(src, f).toContain("This page is still in beta");
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

  it("the Edit control is offered to staff only, with the Staff label", () => {
    expect(card).toContain("const isStaff = useIsAdminUser();");
    expect(card).toContain("isStaff && !editing");
    expect(card).toContain('<MaturityBadge level="staff" />');
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

  it("the toggle renders for staff only, with the Staff label, and defaults to User cost", () => {
    expect(over).toContain("const isStaff = useIsAdminUser();");
    expect(over).toContain('useState<"user" | "actual">("user")');
    // The switch rides the section title's right slot: `right={isStaff && (...)}`.
    expect(over).toContain("isStaff && (");
    expect(over).toContain('<MaturityBadge level="staff" />');
  });

  it("the actual read fires only for staff on the actual basis", () => {
    expect(over).toContain('const actual = isStaff && basis === "actual";');
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
    expect(data).toContain('["workflowRankLadder", brandId, legKey ?? "none", campaignId ?? "none"]');
    expect(data).toContain("leg: legKey, campaignId }");
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
