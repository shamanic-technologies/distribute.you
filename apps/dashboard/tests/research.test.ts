import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseResearchPath, researchCatalogHref, researchPipeFor } from "../src/lib/research/research";

const ROOT = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

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

  it("is a known v2 section", () => {
    expect(read("lib/v2/routes.ts")).toContain('"research"');
  });
});

describe("the maturity rule is features-service's, read per leg and applied everywhere", () => {
  it("draws the line under every chart and states it on the page", () => {
    const src = read("components/v2/research-page.tsx");
    expect(read("components/v2/research-bits.tsx")).toContain("<ChartNote note={chart.note} />");
    expect(src).toContain("<ChartNote note={c.note} />");
    expect(src).toContain("{RESEARCH.maturation.note}");
    // the page reads the rule's own figures, never a measured latency
    expect(src).toContain("RESEARCH.maturation.legs.reply.durationDays");
    expect(src).not.toMatch(/maturation\.(reply|click)\.pAt/);
  });
});

describe("workflow and template pages (the research catalogue)", () => {
  const base = "/v2/orgs/o/brands/b/research";

  it("reads every path under /research, and never mistakes a study for a pipe page", () => {
    expect(parseResearchPath("")).toEqual({ view: "hub" });
    expect(parseResearchPath("cold-email-positive-reply-template-roi")).toEqual({ view: "study", id: "cold-email-positive-reply-template-roi" });
    expect(parseResearchPath("cold-email-positive-reply/workflows")).toEqual({ view: "list", pipe: "cold-email-positive-reply", kind: "workflows" });
    expect(parseResearchPath("cold-email-website-visit/templates/cold-email-v19")).toEqual({ view: "item", pipe: "cold-email-website-visit", kind: "templates", key: "cold-email-v19" });
    expect(parseResearchPath("cold-email-positive-reply/models/gemini-3.1-pro")).toEqual({ view: "item", pipe: "cold-email-positive-reply", kind: "models", key: "gemini-3.1-pro" });
    expect(parseResearchPath("nobody/workflows").view).toBe("missing");
    expect(parseResearchPath("cold-email-positive-reply/audiences").view).toBe("missing");
    expect(researchCatalogHref(base, "cold-email-positive-reply", "workflows", "a b")).toBe(`${base}/cold-email-positive-reply/workflows/a%20b`);
  });

  it("maps a campaign's channel and landing step to its research pipe", () => {
    expect(researchPipeFor("sales-cold-email-outreach", "conversation")).toBe("cold-email-positive-reply");
    expect(researchPipeFor("sales-cold-email-outreach", "website_visit")).toBe("cold-email-website-visit");
    expect(researchPipeFor("sales-cold-email-outreach", null)).toBeNull();
  });

  it("wires the links: hub chips, clickable study bars, template chips, and the template link on the brand workflow page", () => {
    const page = read("components/v2/research-page.tsx");
    expect(page).toContain("<PipeCatalogLinks base={base} pipe={pipe} />");
    expect(page).toContain("hrefFor={(p) => pointHref(base, study, p)}");
    const cat = read("components/v2/research-catalog.tsx");
    expect(cat).toContain('researchCatalogHref(base, pipe, "templates", w.template.key)');
    expect(cat).not.toMatch(/\.sort\(|text-gray-|InfoTooltip/);
    const wf = read("components/v2/workflow-page.tsx");
    expect(wf).toContain("<ResearchTemplateChip");
    expect(read("components/v2/research-template-link.tsx")).not.toContain("useIsAdminUser");
    expect(wf).toContain("<ResearchModelChip");
    // a workflow's alias is never mapped to a model: the chip follows the model Research measured
    expect(read("components/v2/research-template-link.tsx")).toContain("researchWorkflow(catalog, pipe, dynasty)?.model");
    // the chips read the catalogue from the staff-only route (research.ts carries no data any more)
    expect(read("components/v2/research-template-link.tsx")).toContain('useResearchCatalog("user")');
  });
});

describe("the workflows catalogue names each workflow and gives its LLM and template their own columns", () => {
  it("the list renders LLM and Template columns whose cells link to the model and template pages", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
    expect(src).toContain("<th className={`${TH} w-40`}>LLM</th>");
    expect(src).toContain("<th className={`${TH} w-40`}>Template</th>");
    expect(src).toContain('kind="models" r={(r as ResearchWorkflow).model}');
    expect(src).toContain('kind="templates" r={(r as ResearchWorkflow).template}');
    expect(src).toContain("onClick={(e) => e.stopPropagation()}");
  });
});
