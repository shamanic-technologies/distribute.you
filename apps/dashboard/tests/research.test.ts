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

  it("pairs every monthly chart with its average since inception, ending on the winner's own result", () => {
    for (const s of RESEARCH.studies) {
      for (const c of s.charts.filter((ch) => ch.kind === "months")) {
        expect(c.cumulative, s.id).toBeDefined();
        expect(c.cumulative!.points.length, s.id).toBeGreaterThan(0);
      }
      // the cheapest LLM's average since inception IS the price its card states
      if (s.topic === "llm" && s.goal === "roi" && s.result) {
        const months = s.charts.find((c) => c.kind === "months");
        expect(months?.cumulative?.points.at(-1)?.display, s.id).toBe(s.result.display);
      }
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

  it("speaks v2's language: Keel primitives, none of the v1 or no-go classes", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|InfoTooltip|shadow-2xl|max-w-\[1400px\]|max-w-none/);
    for (const primitive of ["<TopBar", "<StatTile", "<SectionTitle", "k-inset", "k-label", "max-w-[1280px]"]) expect(src).toContain(primitive);
    // the staff mark rides the nav entry, never the h1
    expect(src).not.toContain("MaturityBadge");
  });

  it("gives every measured study the figure its card leads with", () => {
    for (const s of RESEARCH.studies) {
      if (s.status === "measured") expect(s.result, s.id).not.toBeNull();
      else expect(s.result).toBeNull();
    }
  });

  it("is a known v2 section", () => {
    expect(read("lib/v2/routes.ts")).toContain('"research"');
  });
});
