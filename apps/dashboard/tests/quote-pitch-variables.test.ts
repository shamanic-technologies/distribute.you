import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  buildQuoteRequestVariable,
  buildAdditionalContextVariable,
  buildBrandVariableFromInputs,
} from "../src/lib/quote-pitch-variables";

describe("expert-quote-pitch variable assembly", () => {
  it("buildQuoteRequestVariable maps opportunity → template `request` shape", () => {
    const out = buildQuoteRequestVariable({
      opportunityText: "What's the biggest mistake in B2B cold email?",
      mediaOutlet: "Forbes",
      journalistName: "Jane Doe",
      deadline: "2026-06-01T00:00:00.000Z",
    });
    expect(out).toEqual({
      question: "What's the biggest mistake in B2B cold email?",
      mediaOutlet: "Forbes",
      source: "Jane Doe",
      deadline: "2026-06-01T00:00:00.000Z",
    });
  });

  it("buildQuoteRequestVariable normalizes missing fields to null, keeps question", () => {
    const out = buildQuoteRequestVariable({ opportunityText: "Q only" });
    expect(out).toEqual({
      question: "Q only",
      mediaOutlet: null,
      source: null,
      deadline: null,
    });
  });

  it("buildAdditionalContextVariable maps whyRelevant + category", () => {
    const out = buildAdditionalContextVariable({
      opportunityText: "x",
      whyRelevant: "Brand sells exactly this",
      category: "Marketing",
    });
    expect(out).toEqual({
      whyRelevant: "Brand sells exactly this",
      category: "Marketing",
    });
  });

  it("buildBrandVariableFromInputs maps the 5 operator featureInputs", () => {
    const out = buildBrandVariableFromInputs({
      spokesperson: "Acme CEO",
      expertiseTopics: "growth, GTM",
      responseStyle: "blunt, data-led",
      companyContext: "Series A SaaS",
      valueProposition: "10x reply rates",
    });
    expect(out).toEqual({
      name: "Acme CEO",
      expertise: "growth, GTM",
      voice: "blunt, data-led",
      companyContext: "Series A SaaS",
      valueProposition: "10x reply rates",
    });
  });
});

describe("expert-quote-pitch consumers send the template's variable contract", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, rel), "utf-8");

  it("authed quote-opportunities page builds brand/request/additionalContext (no legacy flat keys in variables)", () => {
    const page = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/quote-requests/page.tsx",
    );
    const start = page.indexOf("const handleGenerate");
    const end = page.indexOf("const charCount", start);
    const block = page.slice(start, end);
    // New contract keys present.
    expect(block).toContain("buildBrandVariableFromInputs");
    expect(block).toContain("buildQuoteRequestVariable");
    expect(block).toContain("buildAdditionalContextVariable");
    // Legacy flat keys no longer assembled inside the variables object.
    expect(block).not.toContain("spokesperson:");
    expect(block).not.toContain("opportunityText:");
    expect(block).not.toContain("expertiseTopics:");
  });

  it("public-report draft route excludes request/additionalContext from brand-extract", () => {
    const route = read(
      "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/draft/route.ts",
    );
    // Client-supplied (opportunity-context) template vars must NOT be brand-extracted.
    expect(route).toContain('"request"');
    expect(route).toContain('"additionalContext"');
    expect(route).toContain("buildQuoteRequestVariable");
    expect(route).toContain("buildAdditionalContextVariable");
    // The stale flat-name set must be gone.
    expect(route).not.toContain('"opportunityText",\n  "mediaOutlet",\n  "deadline",');
  });

  it("public-report queue forwards journalistName, whyRelevant, category to the draft route", () => {
    const queue = read("../src/components/report/public-hitl-queue.tsx");
    const start = queue.indexOf("fetch(draftUrl");
    const end = queue.indexOf("});", start);
    const block = queue.slice(start, end);
    expect(block).toContain("journalistName");
    expect(block).toContain("whyRelevant");
    expect(block).toContain("category");
  });
});
