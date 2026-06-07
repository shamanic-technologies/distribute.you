import { describe, expect, it } from "vitest";
import {
  buildBenchmarkTitle,
  buildBenchmarkDescription,
} from "@/lib/benchmarks/seo";

// Real feature names crawled by Ahrefs that previously produced 70–90 char titles.
const SAMPLE_FEATURES: { name: string; description: string }[] = [
  {
    name: "AI Visibility Scoring",
    description: "Score how visible your brand is across AI search surfaces.",
  },
  {
    name: "Sales Cold Email Outreach",
    description:
      "Find decision-maker leads at target companies and send personalized cold email at scale.",
  },
  {
    name: "PR Expert Quote Opportunities",
    description:
      "Find live journalist quote requests where your founder can be cited as a source.",
  },
  {
    name: "Accelerators Cold Email Outreach",
    description: "Pitch your startup to top-tier accelerators by cold email.",
  },
  {
    name: "Outlet Database Discovery",
    description:
      "Build a database of niche-relevant publications and outlets for press outreach.",
  },
  {
    name: "Press Kit Page Generation",
    description: "Generate a public press kit landing page for your brand.",
  },
  { name: "Hiring Cold Email Outreach", description: "Cold-source candidates for open roles." },
  { name: "PR Cold Email Outreach", description: "Pitch journalists for coverage by cold email." },
  { name: "VC Cold Email Outreach", description: "Cold email VCs that match your stage and sector." },
  {
    name: "PR Expert Quote Outreach",
    description:
      "Pitch your founder as an expert source on live journalist quote requests.",
  },
];

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

describe("buildBenchmarkTitle", () => {
  for (const f of SAMPLE_FEATURES) {
    it(`"${f.name}" produces title ≤ ${TITLE_LIMIT} chars`, () => {
      const title = buildBenchmarkTitle(f.name);
      expect(title.length).toBeLessThanOrEqual(TITLE_LIMIT);
      expect(title.length).toBeGreaterThan(0);
    });
  }

  it("does NOT contain '| distribute Benchmarks' suffix (kept inside <=60)", () => {
    const title = buildBenchmarkTitle("PR Expert Quote Opportunities");
    expect(title.includes("| distribute Benchmarks")).toBe(false);
  });
});

describe("buildBenchmarkDescription", () => {
  for (const f of SAMPLE_FEATURES) {
    it(`"${f.name}" produces description ≤ ${DESCRIPTION_LIMIT} chars`, () => {
      const desc = buildBenchmarkDescription(f.name, f.description);
      expect(desc.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
      expect(desc.length).toBeGreaterThan(0);
    });
  }

  it("includes feature name", () => {
    const desc = buildBenchmarkDescription(
      "Sales Cold Email Outreach",
      "Find decision-maker leads and send cold email at scale.",
    );
    expect(desc.toLowerCase()).toContain("sales cold email outreach".toLowerCase());
  });
});
