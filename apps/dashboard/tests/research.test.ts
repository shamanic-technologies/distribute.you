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

  it("ranks thin bars by their value and calls the first bar the winner, thin or not", () => {
    // Owner rule 2026-09-27: never sink a thin bar below the others; the first one wins.
    for (const s of RESEARCH.studies.filter((st) => ["llm", "template", "workflow"].includes(st.topic) && st.status === "measured")) {
      const pts = s.charts[0].points;
      expect(s.winner, s.id).toBe(pts[0].label);
      for (let i = 1; i < pts.length; i++) {
        if (s.charts[0].lowerIsBetter) expect(pts[i].value, s.id).toBeGreaterThanOrEqual(pts[i - 1].value);
        else expect(pts[i].value, s.id).toBeLessThanOrEqual(pts[i - 1].value);
      }
      expect(s.crowned, s.id).toBe(!pts[0].thin);
      if (pts[0].thin) expect(s.headline, s.id).toContain("on thin counts");
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

  it("asks the best-workflow questions (ROI and rate) for Herald and Scout, and Pilot says it cannot yet", () => {
    for (const crew of ["herald", "scout"] as const) {
      const wf = studiesFor(crew).filter((s) => s.topic === "workflow");
      expect(wf.map((s) => s.goal).sort()).toEqual(["rate", "roi"]);
      for (const s of wf) expect(s.status, s.id).toBe("measured");
    }
    const pilot = studiesFor("pilot").filter((s) => s.topic === "workflow");
    expect(pilot.map((s) => s.goal).sort()).toEqual(["rate", "roi"]);
    for (const s of pilot) {
      expect(s.status).toBe("not_enough_data");
      expect(s.headline).toBe("Not enough data yet.");
    }
  });

  it("names a workflow by what it runs, never by its codename", () => {
    // every workflow codename in the fleet is a lowercase word joined to its version (`lithium-v6`)
    for (const s of RESEARCH.studies.filter((st) => st.topic === "workflow")) {
      for (const c of s.charts.filter((ch) => ch.kind === "bars")) {
        for (const p of c.points) {
          expect(p.label, s.id).toMatch(/ · /);
          expect(p.label, s.id).not.toMatch(/\b[a-z]+-v\d+\b/);
        }
      }
    }
    // two workflows that run the same model and template still read as two
    const labels = RESEARCH.studies.find((s) => s.id === "herald-workflow-rate")!.charts[0].points.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
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

describe("the maturation window is measured and applied everywhere", () => {
  const m = RESEARCH.maturation;
  const dayMs = 86_400_000;

  it("is the measured figure: the longer of the two outcome latencies, rounded up to a day", () => {
    expect(m.days).toBe(Math.ceil(Math.max(m.reply.pAt, m.click.pAt)));
    expect(m.reply.sample).toBeGreaterThan(0);
    expect(m.click.sample).toBeGreaterThan(0);
    expect(m.percentile).toBe(0.95);
  });

  it("leaves out exactly the emails younger than the window at the window's end", () => {
    expect(Date.parse(`${m.windowEnd}T00:00:00Z`) - Date.parse(`${m.cutoff}T00:00:00Z`)).toBe(m.days * dayMs);
    expect(m.excludedEmails).toBeGreaterThan(0);
    // no month bar can sit after the cutoff's month: those emails were never counted
    const cutoffMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m.cutoff.slice(5, 7)) - 1];
    const last = RESEARCH.volume.byMonth.at(-1)!.label;
    expect(last).toBe(cutoffMonth);
  });

  it("puts the rule under every chart, in the reader's words", () => {
    expect(m.note).toContain(`last ${m.days} days`);
    for (const s of RESEARCH.studies) {
      for (const c of s.charts) {
        expect(c.note, `${s.id}: ${c.title}`).toBeTruthy();
        if (s.topic !== "opens") expect(c.note, s.id).toBe(m.note);
      }
    }
  });

  it("draws the line under every chart and states it on the page", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).toContain("<ChartNote note={chart.note} />");
    expect(src).toContain("<ChartNote note={c.note} />");
    expect(src).toContain("{RESEARCH.maturation.note}");
  });
});
