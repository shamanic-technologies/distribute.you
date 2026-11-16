import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseResearchPath,
  firstMeasureListing,
  researchCatalogHref,
  researchTemplateOf,
  researchTemplateVersion,
  researchTemplateVersionHref,
  templateContentKey,
  templateModels,
  templateRowStatus,
  templatesByTab,
  templateTab,
  type ResearchCatalog,
  type ResearchMeasureCatalog,
  type ResearchScript,
  type ResearchTemplate,
} from "../src/lib/research/research";
import { modelTagFromName } from "../src/lib/written-by";

const ROOT = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("Research is GA", () => {
  it("draws the menu entry for every reader, with no tag", () => {
    const src = read("components/v2/sidebar-menus.tsx");
    expect(src).toContain('{ href: `${base}/research`, label: "Research"');
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

  it("is a known v2 section", () => {
    expect(read("lib/v2/routes.ts")).toContain('"research"');
  });
});

describe("the maturity rule is features-service's, read per counted outcome and applied everywhere", () => {
  it("draws the line under every chart and states it on the page", () => {
    const src = read("components/v2/research-page.tsx");
    expect(read("components/v2/research-bits.tsx")).toContain("<ChartNote note={chart.note} />");
    expect(src).toContain("<ChartNote note={c.note} />");
    expect(src).toContain("{RESEARCH.maturation.note}");
    // the page reads the rule's own figures, never a measured latency
    expect(src).toContain("RESEARCH.maturation.rules.reply.durationDays");
    expect(src).not.toMatch(/maturation\.(reply|click)\.pAt/);
  });
});

describe("script, template and LLM pages (the research catalogue, by Engine)", () => {
  const base = "/v2/orgs/o/brands/b/research";

  it("reads every path under /research, and never mistakes a study for an Engine page", () => {
    expect(parseResearchPath("")).toEqual({ view: "hub" });
    expect(parseResearchPath("email_sent~start~conversation:template-roi")).toEqual({ view: "study", id: "email_sent/start/conversation:template-roi" });
    expect(parseResearchPath("engines/email_sent~start~conversation/scripts")).toEqual({ view: "list", measure: "email_sent/start/conversation", kind: "scripts" });
    expect(parseResearchPath("engines/website_visit~start~website_visit/templates/cold-email-v19")).toEqual({ view: "item", measure: "website_visit/start/website_visit", kind: "templates", key: "cold-email-v19" });
    expect(parseResearchPath("engines/email_sent~start~conversation/llms/gemini-3.1-pro")).toEqual({ view: "item", measure: "email_sent/start/conversation", kind: "llms", key: "gemini-3.1-pro" });
    // any measure id parses: the page answers Not found for one the served file does not list
    expect(parseResearchPath("engines/nobody/scripts").view).toBe("list");
    expect(parseResearchPath("engines/email_sent~start~conversation/audiences").view).toBe("missing");
    expect(researchCatalogHref(base, "email_sent/start/conversation", "scripts", "a b")).toBe(`${base}/engines/email_sent~start~conversation/scripts/a%20b`);
  });

  it("a script's template and LLM chips on the brand workflow page land on the first measure listing them (no channel, no leg)", () => {
    const cat = { engines: [{ outcome: "e", name: "E", measures: [
      { id: "e/start/a", engine: "e", startsFrom: null, counts: { key: "a", name: "A" }, description: "", scripts: [], templates: [], llms: [] },
      { id: "e/start/b", engine: "e", startsFrom: null, counts: { key: "b", name: "B" }, description: "", scripts: [{ key: "wf" }], templates: [], llms: [] },
    ] }] } as unknown as ResearchCatalog;
    expect(firstMeasureListing(cat, (m: ResearchMeasureCatalog) => m.scripts.some((w) => w.key === "wf"))).toBe("e/start/b");
    expect(firstMeasureListing(cat, (m: ResearchMeasureCatalog) => m.scripts.some((w) => w.key === "none"))).toBeNull();
    const link = read("components/v2/research-template-link.tsx");
    expect(link).not.toMatch(/channel|legKey/);
  });

  it("wires the links: hub chips, clickable study bars, template chips, and the template link on the brand workflow page", () => {
    const page = read("components/v2/research-page.tsx");
    expect(page).toContain("<MeasureCatalogLinks base={base} measure={measure} />");
    expect(page).toContain("hrefFor={(p) => pointHref(base, study, p)}");
    const cat = read("components/v2/research-catalog.tsx");
    expect(cat).toContain('researchCatalogHref(base, measure, "templates", template.key)');
    expect(cat).not.toMatch(/\.sort\(|text-gray-|InfoTooltip/);
    const wf = read("components/v2/workflow-page.tsx");
    expect(wf).toContain("<ResearchTemplateChip");
    expect(read("components/v2/research-template-link.tsx")).not.toContain("useIsAdminUser");
    expect(wf).toContain("<ResearchModelChip");
    // a workflow's alias is never mapped to a model: the chip follows the model Research measured
    expect(read("components/v2/research-template-link.tsx")).toContain("researchScript(catalog, measure, dynasty)?.model");
    // the chips read the catalogue from the staff-only route (research.ts carries no data any more)
    expect(read("components/v2/research-template-link.tsx")).toContain('useResearchCatalog("user")');
  });
});

describe("a script page names the script and gives its LLM and template as its TACTICS (RESEARCH-BY-ENGINE-1113)", () => {
  it("the tactics are the served `tactics`, each a link to its own page", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
    const view = src.slice(src.indexOf("function ScriptView("), src.indexOf("function TemplateText("));
    expect(view).toContain("const llm = w.tactics?.llm ?? null;");
    expect(view).toContain("const template = w.tactics?.template ?? null;");
    expect(view).toContain('<p className="k-label mt-5">Tactics</p>');
    expect(view).toContain('<Row k="LLM" v={llm ? <RefLink base={base} measure={measure} kind="llms" r={llm}');
    expect(view).toContain('<Row k="Template" v={template ? <RefLink base={base} measure={measure} kind="templates" r={template}');
  });
});

describe("Template dynasties (TPL-DYNASTY-1021)", () => {
  const fig = { rank: null, emails: "0", emailsNoun: "emails", outcomes: "0", spend: "$0", cost: null, rate: null, thin: true, sample: "", charts: [] };
  const dyn: ResearchTemplate = {
    ...fig,
    key: "cold-reply-free-offer-blind",
    label: "Blind Free Offer",
    hasText: true,
    dynasty: { slug: "cold-reply-free-offer-blind", name: "Blind Free Offer", description: "d", identity: "blind", head: { key: "cold-email-v44", label: "v44" } },
    standaloneReason: null,
    versions: [
      { ...fig, key: "cold-email-v40", label: "v40", head: false, hasText: true },
      { ...fig, key: "cold-email-v44", label: "v44", head: true, hasText: true },
    ],
    scripts: [],
    runs: [],
  };
  const old: ResearchTemplate = { ...fig, key: "cold-email-v12", label: "v12", hasText: true, scripts: [], runs: [] };
  const REPLY = "email_sent/start/conversation";
  const measure = (id: string, lists: Partial<ResearchMeasureCatalog> = {}) => ({
    id,
    engine: id.split("/")[0],
    startsFrom: null,
    counts: { key: "x", name: "X" },
    description: "d",
    scripts: [],
    templates: [],
    llms: [],
    ...lists,
  });
  const catalogWith = (lists: Partial<ResearchMeasureCatalog>): ResearchCatalog => ({
    engines: [
      { outcome: "email_sent", name: "Email sent", measures: [measure(REPLY, lists)] },
      { outcome: "website_visit", name: "Website visit", measures: [measure("website_visit/start/website_visit")] },
    ],
  });
  const catalog = catalogWith({ templates: [dyn, old] });

  it("opens a version's key on its dynasty's page, and a row's own key on itself", () => {
    expect(researchTemplateOf(catalog, REPLY, "cold-email-v40")?.key).toBe("cold-reply-free-offer-blind");
    expect(researchTemplateOf(catalog, REPLY, "cold-reply-free-offer-blind")?.key).toBe("cold-reply-free-offer-blind");
    expect(researchTemplateOf(catalog, REPLY, "cold-email-v12")?.key).toBe("cold-email-v12");
    expect(researchTemplateOf(catalog, REPLY, "nope")).toBeNull();
  });

  it("reads content-generation status and outputs on the head version, a pre-dynasty row on its own key", () => {
    expect(templateContentKey(dyn)).toBe("cold-email-v44");
    expect(templateContentKey(old)).toBe("cold-email-v12");
  });

  const statuses = (entries: [string, string][], answered = true) => ({ answered, map: new Map(entries) });

  it("a row is Active iff its head version is Active; a standalone row reads its own key; null until answered", () => {
    expect(templateRowStatus(dyn, statuses([["cold-email-v44", "active"], ["cold-email-v40", "deprecated"]]))).toBe("active");
    // An active OLD version does not make the dynasty active: only the head counts.
    expect(templateRowStatus(dyn, statuses([["cold-email-v40", "active"], ["cold-email-v44", "deprecated"]]))).toBe("deprecated");
    expect(templateRowStatus(dyn, statuses([]))).toBe("deprecated");
    expect(templateRowStatus(old, statuses([["cold-email-v12", "active"]]))).toBe("active");
    expect(templateRowStatus(dyn, statuses([["cold-email-v44", "active"]], false))).toBeNull();
  });

  it("the dynasty status served by features-service wins over its head version's", () => {
    expect(templateRowStatus({ ...dyn, status: "deprecated" }, statuses([["cold-email-v44", "active"]]))).toBe("deprecated");
    expect(templateRowStatus({ ...dyn, status: "active" }, statuses([], false))).toBe("active");
    expect(templateRowStatus({ ...dyn, status: null }, statuses([["cold-email-v44", "active"]]))).toBe("active");
  });

  it("a template row's Status word and why-note read the row's status, the same one that picks its tab", () => {
    // 2026-10-23: features-service served a head the dynasty had just been upgraded past (v61 -> v75), so the
    // Active tab printed "Deprecated" when the cell read the head version's own status.
    const src = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
    const cell = src.slice(src.indexOf("const status =\n"), src.indexOf("const deprecation = kind"));
    expect(cell).toContain("templateRowStatus(r as ResearchTemplate, templateStatuses)");
    expect(cell).not.toContain("templateStatuses.map.get(");
    expect(src).toContain('const why = templateRowStatus(t, statuses) === "deprecated" ? statuses.deprecationOf(templateContentKey(t)) : null;');
  });

  it("splits the rows into the Active and Deprecated tabs in the served order, nothing while pending", () => {
    const by = templatesByTab([dyn, old], statuses([["cold-email-v44", "active"], ["cold-email-v12", "deprecated"]]));
    expect(by?.active.map((r) => r.key)).toEqual(["cold-reply-free-offer-blind"]);
    expect(by?.deprecated.map((r) => r.key)).toEqual(["cold-email-v12"]);
    expect(templatesByTab([dyn, old], statuses([], false))).toBeNull();
  });

  it("the tab comes from ?status=, Active by default", () => {
    expect(templateTab(null)).toBe("active");
    expect(templateTab("active")).toBe("active");
    expect(templateTab("deprecated")).toBe("deprecated");
    expect(templateTab("nope")).toBe("active");
  });

  it("a version has its own page under its dynasty; one segment still opens the dynasty", () => {
    const href = researchTemplateVersionHref("/r", REPLY, "cold-reply-free-offer-blind", "cold-email-v40");
    expect(href).toBe("/r/engines/email_sent~start~conversation/templates/cold-reply-free-offer-blind/cold-email-v40");
    expect(parseResearchPath(href.slice(3))).toEqual({
      view: "version",
      measure: REPLY,
      kind: "templates",
      key: "cold-reply-free-offer-blind",
      version: "cold-email-v40",
    });
    expect(parseResearchPath("engines/email_sent~start~conversation/templates/cold-email-v40")).toEqual({ view: "item", measure: REPLY, kind: "templates", key: "cold-email-v40" });
    // Only templates have versions; a deeper path is missing.
    expect(parseResearchPath("engines/email_sent~start~conversation/scripts/a/b").view).toBe("missing");
    expect(parseResearchPath("engines/email_sent~start~conversation/templates/a/b/c").view).toBe("missing");
    expect(researchTemplateVersion(dyn, "cold-email-v40")?.label).toBe("v40");
    expect(researchTemplateVersion(dyn, "cold-email-v99")).toBeNull();
  });

  it("the LLMs a row wrote with: its scripts' LLMs, then its runs', each once, first seen first", () => {
    const claude = { key: "claude-opus", label: "Claude Opus 5.5", linked: true };
    const gemini = { key: "gemini-flash", label: "Gemini 3 Flash", linked: true };
    const wf = { ...fig, key: "wf-a", label: "A", name: "A", model: claude, template: null, runs: [] } as ResearchScript;
    const row: ResearchTemplate = {
      ...dyn,
      scripts: [{ key: "wf-a", label: "A" }, { key: "wf-gone", label: "Gone" }],
      runs: [
        { when: "", model: gemini, script: null, version: null, tokens: null },
        { when: "", model: claude, script: null, version: null, tokens: null },
      ],
    };
    const cat = catalogWith({ scripts: [wf], templates: [row] });
    expect(templateModels(cat, REPLY, row).map((m) => m.key)).toEqual(["claude-opus", "gemini-flash"]);
    expect(templateModels(null, REPLY, row).map((m) => m.key)).toEqual(["gemini-flash", "claude-opus"]);
  });

  it("a model named only by its label wears its product mark", () => {
    expect(modelTagFromName("Claude Opus 5.5")).toEqual({ label: "Opus 5.5", name: "Claude Opus 5.5", logoSrc: "/model-logos/claude.svg" });
    expect(modelTagFromName("gemini 3 flash").logoSrc).toBe("/model-logos/gemini.svg");
    expect(modelTagFromName("Jev 1.13")).toEqual({ label: "Jev 1.13", name: "Jev 1.13", logoSrc: null });
  });

  it("the Templates list wires tabs, the panel and the version drawer and page", () => {
    const cat = read("components/v2/research-catalog.tsx");
    expect(cat).toContain('const tab = templateTab(search?.get("status"));');
    expect(cat).toContain("templatesByTab(rows as ResearchTemplate[], templateStatuses)");
    expect(cat).toContain('window.history.replaceState(null, "",');
    expect(cat).toContain("<TemplateVersionDrawer");
    expect(cat).toContain("researchTemplateVersionHref(base, measure, t.key, open.key)");
    expect(cat).toContain("<TemplateVersionView");
    const panel = read("components/v2/research-template-outputs.tsx");
    expect(panel).toContain("useTemplateRowOutputs(t, 4)");
    expect(panel).toContain("useTemplateOutputs(version.key, 5)");
    expect(panel).toContain('document.getElementById("v2-portal")');
    // No return per template (ROI-CONSISTENCY-1103).
    expect(panel).not.toContain("RoiLabel");
    expect(panel).not.toMatch(/transition-all|text-gray-/);
    expect(read("components/v2/research-page.tsx")).toContain('versionKey={view.view === "version" ? view.version : null}');
  });
});

describe("Templates render in the served order (RESEARCH-TPL-SERVED-ORDER-1023)", () => {
  it("keeps the served order even when it is not the cheapest $ / outcome order", () => {
    // features-service serves the pipe's pick order: a cheap learning template first (no $ / outcome yet),
    // then mature, then other learning. The cheapest $ / outcome here is last; it must stay last.
    const fig = { roi: null, conversion: null, outcomes: null, rank: null };
    const row = (key: string, cost: string | null, spend: string): ResearchTemplate =>
      ({ ...fig, key, label: key, dynasty: key, status: "active", cost, spend, hasText: true, workflows: [], runs: [] }) as unknown as ResearchTemplate;
    const rows = [row("brand-first-stack", null, "$14"), row("pain-question", "$166", "$4,000"), row("three-line-reply", "$137", "$1,370"), row("researched-observation", "$90", "$900")];
    const tabs = templatesByTab(rows, { answered: true, map: new Map() });
    expect(tabs?.active.map((r) => r.key)).toEqual(["brand-first-stack", "pain-question", "three-line-reply", "researched-observation"]);
  });
});
