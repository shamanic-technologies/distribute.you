import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREW_ORDER,
  RESEARCH,
  loadResearchCatalog,
  parseResearchPath,
  pointHref,
  researchCatalogHref,
  researchCrewFor,
  researchModel,
  researchTemplate,
  researchWorkflow,
  studyById,
  studiesFor,
} from "../src/lib/research/research";
import catalogJson from "../src/lib/research/research-catalog.json";
import textsJson from "../src/lib/research/research-templates.json";

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
      expect(s.headline, s.id).not.toMatch(/thin/i);
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

  it("asks whether naming the client wins positive replies, on the positive-reply leg only, in plain words", () => {
    const naming = RESEARCH.studies.filter((s) => s.topic === "naming");
    expect(naming.map((s) => `${s.crew}-${s.goal}`).sort()).toEqual(["herald-rate", "herald-roi"]);
    for (const s of naming) {
      expect(s.status, s.id).toBe("measured");
      expect(s.charts[0].points.map((p) => p.label).sort(), s.id).toEqual(["Client named", "Client not named"]);
      expect(s.headline, s.id).toMatch(/\(p [<\d]/);
      // a winner is only called on a significant difference, and then it is the first bar
      expect(s.crowned, s.id).toBe(s.winner !== null);
      if (s.winner) expect(s.charts[0].points[0].label, s.id).toBe(s.winner);
      else expect(s.headline, s.id).toMatch(/not significant/);
      expect(s.conclusion.join(" "), s.id).toContain("not a split test");
      expect(s.charts[0].note, s.id).toBe(RESEARCH.maturation.note);
      // the crews' names stay internal: the study joins its section by its crew field alone
      const text = [s.question, s.headline, s.result?.unit ?? "", s.result?.sample ?? "", ...s.conclusion, ...s.charts.flatMap((c) => [c.title, c.note ?? "", ...c.points.flatMap((p) => [p.label, p.note])])].join(" ");
      expect(text, s.id).not.toMatch(/herald|scout|pilot|blind|discovery|cold email/i);
    }
  });

  it("writes no em-dash anywhere a reader sees", () => {
    expect(JSON.stringify(RESEARCH)).not.toContain("—");
  });
});

describe("Research is GA", () => {
  it("draws the menu entry for every reader, above Refer a friend, with no tag", () => {
    const src = read("components/v2/sidebar-menus.tsx");
    expect(src).toContain('{ href: `${base}/research`, label: "Research"');
    expect(src.indexOf('label: "Research"')).toBeLessThan(src.indexOf('label: "Refer a friend", icon'));
    expect(src).not.toContain("isAdminEmail");
    expect(src).not.toContain("MaturityBadge");
  });

  it("both routes render the page for every reader, with no staff check", () => {
    for (const route of ["research/page.tsx", "research/[...path]/page.tsx"]) {
      const page = read(`app/(authed)/v2/orgs/[orgId]/brands/[brandId]/${route}`);
      expect(page).not.toContain("isAdminEmail");
      expect(page).toContain("<V2Research />");
    }
    expect(read("components/v2/research-page.tsx")).not.toContain("NotAvailable");
  });

  it("paints at once: no wait on Clerk, questions switch without a server round-trip, the menu entry is prefetched", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).not.toContain("useUser");
    expect(src).not.toContain("<Loading");
    expect(src).toContain("window.history.pushState(null, \"\", href)");
    expect(src).toContain("onClickCapture={onClickCapture}");
    expect(read("components/v2/sidebar-menus.tsx")).toContain("prefetch={l.prefetch ? true : undefined}");
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
    expect(read("components/v2/research-bits.tsx")).toContain("<ChartNote note={chart.note} />");
    expect(src).toContain("<ChartNote note={c.note} />");
    expect(src).toContain("{RESEARCH.maturation.note}");
  });
});

describe("workflow and template pages (the research catalogue)", () => {
  const catalog = catalogJson as unknown as Awaited<ReturnType<typeof loadResearchCatalog>>;
  const texts = textsJson as Record<string, string>;
  const base = "/v2/orgs/o/brands/b/research";

  it("reads every path under /research, and never mistakes a study for a crew page", () => {
    expect(parseResearchPath("")).toEqual({ view: "hub" });
    expect(parseResearchPath("herald-template-roi")).toEqual({ view: "study", id: "herald-template-roi" });
    expect(parseResearchPath("herald/workflows")).toEqual({ view: "list", crew: "herald", kind: "workflows" });
    expect(parseResearchPath("scout/templates/cold-email-v19")).toEqual({ view: "item", crew: "scout", kind: "templates", key: "cold-email-v19" });
    expect(parseResearchPath("herald/models/gemini-3.1-pro")).toEqual({ view: "item", crew: "herald", kind: "models", key: "gemini-3.1-pro" });
    expect(parseResearchPath("nobody/workflows").view).toBe("missing");
    expect(parseResearchPath("herald/audiences").view).toBe("missing");
    expect(researchCatalogHref(base, "herald", "workflows", "a b")).toBe(`${base}/herald/workflows/a%20b`);
  });

  it("lists, for each crew, what the hub counts", () => {
    for (const crew of CREW_ORDER) {
      expect(catalog[crew].workflows.length).toBe(RESEARCH.catalogCounts[crew].workflows);
      expect(catalog[crew].templates.length).toBe(RESEARCH.catalogCounts[crew].templates);
      expect(catalog[crew].models.length).toBe(RESEARCH.catalogCounts[crew].models);
    }
    expect(catalog.herald.workflows.length).toBeGreaterThan(0);
    expect(catalog.scout.templates.length).toBeGreaterThan(0);
  });

  it("gives every bar of a workflow or template study a page, and no other study a link", () => {
    for (const s of RESEARCH.studies) {
      for (const c of s.charts.filter((ch) => ch.kind === "bars")) {
        for (const p of c.points) {
          const href = pointHref(base, s, p);
          if (s.topic === "workflow") {
            expect(researchWorkflow(catalog, s.crew, p.key!), `${s.id} ${p.label}`).not.toBeNull();
            expect(href).toBe(`${base}/${s.crew}/workflows/${encodeURIComponent(p.key!)}`);
          } else if (s.topic === "template") {
            expect(researchTemplate(catalog, s.crew, p.key!), `${s.id} ${p.label}`).not.toBeNull();
            expect(href).toBe(`${base}/${s.crew}/templates/${encodeURIComponent(p.key!)}`);
          } else if (s.topic === "llm") {
            expect(researchModel(catalog, s.crew, p.key!), `${s.id} ${p.label}`).not.toBeNull();
            expect(researchModel(catalog, s.crew, p.key!)!.label).toBe(p.label);
            expect(href).toBe(`${base}/${s.crew}/models/${encodeURIComponent(p.key!)}`);
          } else {
            expect(href).toBeNull();
          }
        }
      }
    }
  });

  it("states the same figure on a workflow page as on the study's bar", () => {
    const study = RESEARCH.studies.find((s) => s.id === "herald-workflow-roi")!;
    for (const p of study.charts[0].points) {
      const w = researchWorkflow(catalog, "herald", p.key!)!;
      expect(w.label).toBe(p.label);
      expect(w.cost).toBe(p.display);
    }
    const tStudy = RESEARCH.studies.find((s) => s.id === "scout-template-roi")!;
    for (const p of tStudy.charts[0].points) expect(researchTemplate(catalog, "scout", p.key!)!.cost).toBe(p.display);
    const mStudy = RESEARCH.studies.find((s) => s.id === "herald-llm-roi")!;
    for (const p of mStudy.charts[0].points) expect(researchModel(catalog, "herald", p.key!)!.cost).toBe(p.display);
  });

  it("links a workflow to its template's page only when that page exists, and every template carries its text", () => {
    for (const crew of CREW_ORDER) {
      for (const w of catalog[crew].workflows) {
        if (w.template?.linked) expect(researchTemplate(catalog, crew, w.template.key)).not.toBeNull();
        if (w.model?.linked) expect(researchModel(catalog, crew, w.model.key)).not.toBeNull();
        expect(w.label).not.toMatch(/\b[a-z]+-v\d+\b/);
        for (const r of w.runs) expect(r.cost === null || r.cost.startsWith("$")).toBe(true);
      }
      for (const t of catalog[crew].templates) {
        if (t.hasText) expect(texts[t.key]?.length, t.key).toBeGreaterThan(0);
        for (const wf of t.workflows) expect(researchWorkflow(catalog, crew, wf.key)).not.toBeNull();
      }
      for (const m of catalog[crew].models) {
        for (const wf of m.workflows) expect(researchWorkflow(catalog, crew, wf.key)!.model?.key).toBe(m.key);
        for (const r of m.runs) if (r.template?.linked) expect(researchTemplate(catalog, crew, r.template.key)).not.toBeNull();
      }
    }
  });

  it("maps a mission's crew to its research crew", () => {
    expect(researchCrewFor("sales-cold-email-outreach", "conversation")).toBe("herald");
    expect(researchCrewFor("sales-cold-email-outreach", "website_visit")).toBe("scout");
    expect(researchCrewFor("sales-cold-email-outreach", null)).toBeNull();
  });

  it("writes no em-dash and names no client in the catalogue", () => {
    expect(JSON.stringify(catalog)).not.toContain("\u2014");
    expect(JSON.stringify(catalog)).not.toMatch(/org_|@/);
  });

  it("wires the links: hub chips, clickable study bars, template chips, and the template link on the brand workflow page", () => {
    const page = read("components/v2/research-page.tsx");
    expect(page).toContain("<CrewCatalogLinks base={base} crew={crew} />");
    expect(page).toContain("hrefFor={(p) => pointHref(base, study, p)}");
    expect(page).toContain("preloadResearchCatalog()");
    const cat = read("components/v2/research-catalog.tsx");
    expect(cat).toContain('researchCatalogHref(base, crew, "templates", w.template.key)');
    expect(cat).not.toMatch(/\.sort\(|text-gray-|InfoTooltip/);
    const wf = read("components/v2/workflow-page.tsx");
    expect(wf).toContain("<ResearchTemplateChip");
    expect(read("components/v2/research-template-link.tsx")).not.toContain("useIsAdminUser");
    expect(wf).toContain("<ResearchModelChip");
    // a workflow's alias is never mapped to a model: the chip follows the model Research measured
    expect(read("components/v2/research-template-link.tsx")).toContain("researchWorkflow(catalog, crew, dynasty)?.model");
    // the brand workflow page loads the research module on demand, never statically
    expect(read("components/v2/research-template-link.tsx")).not.toMatch(/from "@\/lib\/research\/research"/);
  });
});

describe("the workflows catalogue names each workflow and gives its LLM and template their own columns", () => {
  const catalog = catalogJson as unknown as Record<string, { workflows: { key: string; name: string | null }[] }>;
  it("every workflow carries the name workflow-service states for it", () => {
    for (const crew of Object.values(catalog)) for (const w of crew.workflows) expect(w.name, w.key).toBeTruthy();
  });
  it("the list renders LLM and Template columns whose cells link to the model and template pages", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
    expect(src).toContain("<th className={`${TH} w-40`}>LLM</th>");
    expect(src).toContain("<th className={`${TH} w-40`}>Template</th>");
    expect(src).toContain('kind="models" r={(r as ResearchWorkflow).model}');
    expect(src).toContain('kind="templates" r={(r as ResearchWorkflow).template}');
    expect(src).toContain("onClick={(e) => e.stopPropagation()}");
  });
});
