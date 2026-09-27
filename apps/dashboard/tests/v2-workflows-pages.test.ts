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
