import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CREW_ORDER, RESEARCH, studyById, studiesFor } from "../src/lib/research/research";

const ROOT = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("research.json is coherent", () => {
  it("is fleet-wide and carries a window and a volume", () => {
    expect(RESEARCH.allOrgs).toBe(true);
    expect(RESEARCH.window.from <= RESEARCH.window.to).toBe(true);
    expect(RESEARCH.volume.emails).toBeGreaterThan(0);
  });

  it("gives every study a unique id and a known crew", () => {
    const ids = RESEARCH.studies.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of RESEARCH.studies) expect(CREW_ORDER).toContain(s.crew);
    for (const s of RESEARCH.studies) expect(studyById(s.id)).toBe(s);
  });

  it("covers the nine questions for Herald and for Scout, plus Pilot", () => {
    for (const crew of ["herald", "scout"] as const) {
      const topics = studiesFor(crew).map((s) => `${s.topic}-${s.goal}`);
      for (const t of ["llm-roi", "llm-rate", "cost-roi", "followups-roi", "followups-rate", "opens-roi", "opens-rate", "template-roi", "template-rate"]) {
        expect(topics).toContain(t);
      }
    }
    expect(studiesFor("pilot").length).toBeGreaterThan(0);
  });

  it("draws something for every measured study, and nothing is invented for one that is not", () => {
    for (const s of RESEARCH.studies) {
      if (s.status === "measured") {
        expect(s.charts.length).toBeGreaterThan(0);
        expect(s.charts.some((c) => c.points.length > 0)).toBe(true);
      } else {
        expect(s.crowned).toBe(false);
      }
    }
  });

  it("names a winner that is a bar of the study's first chart", () => {
    for (const s of RESEARCH.studies) {
      if (!s.winner || s.topic === "cost") continue;
      const labels = s.charts[0].points.map((p) => p.label);
      expect(labels, s.id).toContain(s.winner);
    }
  });

  it("writes no em-dash anywhere a reader sees", () => {
    expect(JSON.stringify(RESEARCH)).not.toContain("—");
  });
});

describe("Research is staff-only", () => {
  it("draws the menu entry for the staff list alone, above Refer a friend, with a staff tag", () => {
    const src = read("components/v2/sidebar-menus.tsx");
    expect(src).toContain("const staff = isAdminEmail(email);");
    expect(src).toContain('...(staff ? [{ href: `${base}/research`, label: "Research"');
    expect(src.indexOf('label: "Research"')).toBeLessThan(src.indexOf('label: "Refer a friend", icon'));
    expect(src).toContain('<MaturityBadge level="staff" />');
  });

  it("checks the same list on both pages, so a typed URL shows nothing", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).toContain("isAdminEmail(user?.primaryEmailAddress?.emailAddress)");
    expect(src.match(/if \(!gate\.staff\) return <NotAvailable \/>;/g)?.length).toBe(2);
  });

  it("computes nothing: no division, no sort in the page", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).not.toMatch(/\.sort\(/);
  });

  it("is a known v2 section", () => {
    expect(read("lib/v2/routes.ts")).toContain('"research"');
  });
});
