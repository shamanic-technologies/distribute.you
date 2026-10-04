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

  it("every org on the platform is listed in staff mode only", () => {
    const s = read("components/v2/sidebar-menus.tsx");
    expect(s).toContain("const orgs = allOrgs");
    expect(s).not.toContain("const orgs = t.isStaff");
  });
});

describe("nothing below a mission reaches a customer", () => {
  it("the sidebar Workflows entry is staff mode only", () => {
    const s = read("components/v2/v2-shell.tsx");
    const at = s.indexOf('label="Workflows"');
    expect(s.slice(at - 200, at)).toContain("{staffMode && (");
  });

  it("the mission Workflows tab is staff mode only, and every caller states the mode", () => {
    const s = read("components/v2/setup-pages.tsx");
    expect(s).toContain('...(staffMode ? [{ label: "Workflows"');
    const calls = [...s.matchAll(/missionTabs\(orgId, brandId, [^)]*\)/g)].map((m) => m[0]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c).toContain("staffMode");
    expect(read("components/v2/mission-page.tsx")).toContain('"overview", staffMode)');
  });

  it("the crew card's Workflows link is staff mode only", () => {
    expect(read("components/v2/crew-page.tsx")).toContain("{staffMode && missions.length === 1 && (");
  });

  it("the workflow, mission-workflow and research pages sit behind StaffOnly", () => {
    const base = "app/(authed)/v2/orgs/[orgId]/brands/[brandId]/";
    for (const p of ["workflows/page.tsx", "workflows/[workflowSlug]/page.tsx", "research/page.tsx", "research/[...path]/page.tsx"]) {
      expect(read(base + p)).toContain("<StaffOnly>");
    }
    const s = read("components/v2/setup-pages.tsx");
    const at = s.indexOf("export function V2MissionWorkflowsPage");
    expect(s.slice(at, s.indexOf("// ─── Integrations", at))).toContain("<StaffOnly>");
  });

  it("the run page names the workflow, version, model and template in staff mode only", () => {
    const s = read("components/v2/run-page.tsx");
    const gate = s.indexOf("{staffMode && (");
    expect(gate).toBeGreaterThan(-1);
    for (const k of ['k="Workflow"', 'k="Version"', 'k="LLM"', 'k="Template"']) expect(s.indexOf(k)).toBeGreaterThan(gate);
    expect(s).toContain("missionName ?? (run ?");
  });

  it("customer copy never says workflow", () => {
    for (const f of ["components/v2/new-org-modal.tsx", "components/v2/get-started/launch.ts", "components/settings/offer-campaigns-card.tsx"]) {
      const s = read(f);
      for (const retired of ["No workflow is ready", "has no workflow ready", "with our best workflow"]) expect(s).not.toContain(retired);
    }
  });
});

describe("Work, Crew and Missions are staff mode only (owner 2026-10-03: a simpler dashboard for customers)", () => {
  const route = (p: string) => read(`app/(authed)/v2/orgs/[orgId]/brands/[brandId]/${p}/page.tsx`);

  it("the pages sit behind StaffOnly, the mission detail page stays open (onboarding lands there)", () => {
    for (const p of ["work", "work/runs/[runId]", "crew", "missions"]) expect(route(p)).toContain("<StaffOnly>");
    expect(route("missions/[campaignId]")).not.toContain("StaffOnly");
  });

  it("the sidebar entries and its Crew / Missions groups need staff mode", () => {
    const shell = read("components/v2/v2-shell.tsx");
    const at = shell.indexOf("{staffMode && (\n            <>");
    expect(at).toBeGreaterThan(-1);
    const block = shell.slice(at, shell.indexOf("</>", at));
    for (const s of ['"work"', '"crew"', '"missions"']) expect(block).toContain(`v2Href(orgId, brandId, ${s})`);
    expect(shell).toContain("{staffMode && activeCrews.length > 0 && (");
    expect(shell).toContain("{staffMode && activeMissions.length > 0 && (");
  });

  it("the G-keys and the palette skip them outside staff mode", () => {
    const menus = read("components/v2/sidebar-menus.tsx");
    for (const k of ['"work", label: "Work", key: "w", staff: true', '"crew", label: "Crew", key: "c", staff: true', '"missions", label: "Missions", key: "m", staff: true']) {
      expect(menus).toContain(k);
    }
    expect(menus).toContain("if (g.staff && !staffMode) continue;");
    expect(menus).toContain("(!g.staff || staffMode)");
  });

  it("Today and the bell send a customer's 'needs your call' to the Inbox, not Work", () => {
    expect(read("components/v2/today-page.tsx")).toContain('const callHref = staffMode ? v2Href(orgId, brandId, "work") : `${v2Href(orgId, brandId, "people")}?tab=positive-replies`;');
    expect(read("components/v2/ui.tsx")).toContain('href={staffMode ? v2Href(orgId, brandId, "work") : `${v2Href(orgId, brandId, "people")}?tab=positive-replies`}');
  });
});
