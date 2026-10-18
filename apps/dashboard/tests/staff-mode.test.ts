import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAFF_MODE_COOKIE, staffModeCookieAssignment, staffModeFromCookie } from "../src/lib/staff-mode-cookie";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("staff mode cookie", () => {
  it("reads ON when absent, OFF only on an explicit off", () => {
    expect(staffModeFromCookie(undefined)).toBe(true);
    expect(staffModeFromCookie("")).toBe(true);
    expect(staffModeFromCookie("a=b")).toBe(true);
    expect(staffModeFromCookie(`a=b; ${STAFF_MODE_COOKIE}=off`)).toBe(false);
    expect(staffModeFromCookie(`${STAFF_MODE_COOKIE}=on`)).toBe(true);
  });
  it("round-trips through its own assignment", () => {
    expect(staffModeFromCookie(staffModeCookieAssignment(false).split(";")[0])).toBe(false);
    expect(staffModeFromCookie(staffModeCookieAssignment(true).split(";")[0])).toBe(true);
  });
});

describe("staff mode is the ONE staff gate of the customer dashboard", () => {
  it("staff mode needs a staff email AND the switch", () => {
    const hook = read("lib/use-staff-mode.ts");
    expect(hook).toContain("staffMode: isStaff && on");
  });

  it("the stat and cost switches read staff mode, not the email alone", () => {
    for (const f of ["lib/use-stat-basis.ts", "lib/v2/use-cost-basis.ts"]) {
      const s = read(f);
      expect(s).toContain("useStaffMode()");
      expect(s).not.toContain("useIsAdminUser()");
    }
  });

  it("no staff tag is left anywhere in the dashboard", () => {
    for (const f of ["components/v2/stat-basis-switch.tsx", "components/v2/cost-basis-switch.tsx", "components/v2/workflow-page.tsx"]) {
      expect(read(f)).not.toContain('level="staff"');
    }
  });

  it("the account menu carries the switch, for staff emails only, and Research only in staff mode", () => {
    const s = read("components/v2/sidebar-menus.tsx");
    expect(s).toContain("{isStaff && (");
    expect(s).toContain("Staff mode");
    expect(s).toContain('...(staffMode ? [{ href: `${base}/research`');
  });

  it("every org on the platform is listed for any staff reader, staff mode on or off", () => {
    const s = read("components/v2/sidebar-menus.tsx");
    expect(s).toContain("const allOrgs = t.isStaff;");
    expect(s).toMatch(/orgs: allOrgs\s*\?\s*t\.allOrgs/);
    expect(s).not.toContain("const orgs = t.isStaff");
  });
});

describe("nothing below a campaign reaches a customer", () => {
  it("the sidebar Workflows section (with every business-object section) is staff mode only", () => {
    const s = read("components/v2/v2-shell.tsx");
    expect(s).toContain("{staffMode && <StaffObjectSections");
    const at = s.indexOf('<Group title="Workflows">');
    expect(at).toBeGreaterThan(s.indexOf("function StaffObjectSections("));
  });

  it("Audience lists are GA (owner 2026-10-05), now Targeting's Lists tab (owner 2026-10-07): no staff gate on the tab or the page", () => {
    const s = read("components/v2/setup-pages.tsx");
    const at = s.indexOf('{ label: "Lists"');
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at - 200, at)).not.toContain("staffMode");
    expect(read("app/(authed)/v2/orgs/[orgId]/brands/[brandId]/offers/[offerId]/targeting/lists/page.tsx")).not.toContain("<StaffOnly>");
  });

  it("Audience keeps vendor cost, provider and P(yes) for staff mode, and a customer reads its own org's routes", () => {
    const s = read("components/v2/audience-page.tsx");
    expect(s).toContain("const { staffMode: staff } = useStaffMode();");
    expect(s).toContain("vendor={staff}");
    // Every source carries its provider's logo for everyone (owner 2026-10-09); vendor $ stays staff.
    expect(s).toContain("origin?.provider ? <ProviderLogo domain={origin.provider.domain}");
    expect(s).toContain("const src = staff ? refSource(r) : null;");
    expect(s).toContain("staff && r.yesProbability != null");
    const api = read("lib/api.ts");
    expect(api).toContain("ORG_AUDIENCE_PATHS.snapshot(brandId)");
    expect(api).toContain("ORG_AUDIENCE_PATHS.investment(brandId)");
  });

  it("the campaign Workflows tab is staff mode only, its body behind StaffOnly", () => {
    const s = read("components/v2/campaign-page.tsx");
    expect(s).toContain('{ key: "workflows", label: "Workflows", staff: true }');
    expect(s).toContain("CAMPAIGN_TABS.filter((t) => !t.staff || staffMode)");
    expect(s.slice(s.indexOf("<StaffOnly>"))).toContain("<CampaignWorkflowsPage");
  });

  it("the workflow, campaign-workflow, run and research pages sit behind StaffOnly", () => {
    const base = "app/(authed)/v2/orgs/[orgId]/brands/[brandId]/";
    for (const p of ["workflows/page.tsx", "workflows/[workflowSlug]/page.tsx", "runs/[runId]/page.tsx", "research/page.tsx", "research/[...path]/page.tsx"]) {
      expect(read(base + p)).toContain("<StaffOnly>");
    }
    const s = read("components/v2/campaign-page.tsx");
    expect(s.slice(s.indexOf("<StaffOnly>"), s.indexOf("</StaffOnly>"))).toContain("<CampaignWorkflowsPage");
  });

  it("the run page names the workflow, version, model and template in staff mode only", () => {
    const s = read("components/v2/run-page.tsx");
    const gate = s.indexOf("{staffMode && (");
    expect(gate).toBeGreaterThan(-1);
    for (const k of ['k="Workflow"', 'k="Version"', 'k="LLM"', 'k="Template"']) expect(s.indexOf(k)).toBeGreaterThan(gate);
    expect(s).toContain("campaignName ?? (run ?");
  });

  it("customer copy never says workflow", () => {
    for (const f of ["components/v2/get-started/org-launch.tsx", "components/v2/get-started/launch.ts", "components/settings/offer-campaigns-card.tsx"]) {
      const s = read(f);
      for (const retired of ["No workflow is ready", "has no workflow ready", "with our best workflow"]) expect(s).not.toContain(retired);
    }
  });
});

describe("the retired staff pages are redirects (2026-10-18)", () => {
  const route = (p: string) => read(`app/(authed)/v2/orgs/[orgId]/brands/[brandId]/${p}/page.tsx`);

  it("old bookmarks land on Campaigns, an old run URL on its run page; the campaign page stays open", () => {
    for (const p of ["work", ["cr", "ew"].join("")]) expect(route(p)).toContain("/campaigns`);");
    expect(route("work/runs/[runId]")).toContain("/runs/${encodeURIComponent(runId)}`);");
    expect(route("campaigns/[campaignId]")).not.toContain("StaffOnly");
  });

  it("the sidebar, the G-keys and the palette carry no entry for them", () => {
    const shell = read("components/v2/v2-shell.tsx");
    expect(shell).not.toContain('v2Href(orgId, brandId, "work")');
    const menus = read("components/v2/sidebar-menus.tsx");
    expect(menus).not.toContain('section: "work"');
    expect(menus).not.toContain('key: "c", staff: true');
    expect(menus).toContain("if (g.staff && !staffMode) continue;");
    expect(menus).toContain("(!g.staff || staffMode)");
  });

  it("Today and the bell send 'needs your call' to the Inbox", () => {
    expect(read("components/v2/today-page.tsx")).toContain('const callHref = `${v2Href(orgId, brandId, "people")}?tab=positive-replies`;');
    expect(read("components/v2/ui.tsx")).toContain('href={`${v2Href(orgId, brandId, "people")}?tab=positive-replies`}');
  });
});
