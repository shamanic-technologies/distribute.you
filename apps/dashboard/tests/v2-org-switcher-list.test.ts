import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORG_SEARCH_MIN, moveOrgCursor, showOrgSearch, switcherOrgs } from "../src/lib/v2/org-switcher-list";

const org = (id: string, name = id) => ({ id, name });

describe("org switcher list (staff reads like GA)", () => {
  it("shows the search box only past the threshold, or while a search is typed", () => {
    expect(ORG_SEARCH_MIN).toBe(8);
    expect(showOrgSearch(8, "")).toBe(false);
    expect(showOrgSearch(9, "")).toBe(true);
    expect(showOrgSearch(2, "acm")).toBe(true);
  });

  it("filters a customer's memberships by name, case-insensitive", () => {
    const orgs = [org("a", "Acme"), org("b", "Beta"), org("c", "acme labs")];
    expect(switcherOrgs({ orgs, query: " ACME ", filterLocally: true, current: org("b", "Beta") }).map((o) => o.id)).toEqual(["a", "c"]);
  });

  it("keeps the server-filtered staff list as served", () => {
    const orgs = [org("x", "Zed")];
    expect(switcherOrgs({ orgs, query: "acme", filterLocally: false, current: null })).toEqual(orgs);
  });

  it("pins the current org first, prepending it when the fetched page lacks it", () => {
    const orgs = [org("a"), org("b"), org("c")];
    expect(switcherOrgs({ orgs, query: "", filterLocally: false, current: org("b") }).map((o) => o.id)).toEqual(["b", "a", "c"]);
    expect(switcherOrgs({ orgs, query: "", filterLocally: false, current: org("z") }).map((o) => o.id)).toEqual(["z", "a", "b", "c"]);
  });

  it("the sidebar switcher uses one Organizations block for staff and customers", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/sidebar-menus.tsx"), "utf8");
    const start = src.indexOf("export function TenantSwitcherV2(");
    const block = src.slice(start, src.indexOf("// ─── Account menu", start));
    expect(block).toContain("switcherOrgs({");
    expect(block).toContain("showOrgSearch(");
    expect(block).toContain('placeholder="Search organizations…"');
    expect(block).not.toContain("Search all organizations");
  });
});

describe("org switcher keyboard pick", () => {
  it("moves the highlight with wrap, starting from nothing", () => {
    expect(moveOrgCursor(-1, 3, 1)).toBe(0);
    expect(moveOrgCursor(-1, 3, -1)).toBe(2);
    expect(moveOrgCursor(0, 3, 1)).toBe(1);
    expect(moveOrgCursor(2, 3, 1)).toBe(0);
    expect(moveOrgCursor(0, 3, -1)).toBe(2);
    expect(moveOrgCursor(5, 3, 1)).toBe(0);
    expect(moveOrgCursor(0, 0, 1)).toBe(-1);
  });

  it("the search box drives the highlight: arrows move it, Enter opens it, typing preselects the first", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/sidebar-menus.tsx"), "utf8");
    const start = src.indexOf("export function TenantSwitcherV2(");
    const block = src.slice(start, src.indexOf("// ─── Account menu", start));
    expect(block).toContain("useEffect(() => setOrgCursor(t.orgSearch.trim() ? 0 : -1), [t.orgSearch]);");
    expect(block).toContain('e.key === "ArrowDown"');
    expect(block).toContain("moveOrgCursor(c, orgs.length,");
    expect(block).toContain("const o = orgs[orgCursor];");
    expect(block).toContain("pickOrg(o)");
    expect(block).toContain("data-org-idx={i}");
  });
});
