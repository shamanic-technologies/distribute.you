import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { researchConclusions, researchStudies } from "../src/lib/research/conclusions";
import type { ResearchFile } from "../src/lib/research/research";
import { GET } from "../src/app/api/internal/research/studies/route";

const FILE: ResearchFile = JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "research", "research.json"), "utf8"));
const URL = "https://dashboard.example.test/api/internal/research/studies";

describe("research studies: every measured study, quotable only when a conclusion", () => {
  const body = researchStudies(FILE);

  it("serves every measured study, and only those", () => {
    const measured = FILE.studies.filter((s) => s.status === "measured").map((s) => s.id);
    expect(body.studies.map((s) => s.id).sort()).toEqual([...measured].sort());
    expect(body.costBasis).toBe("user");
  });

  it("marks quotable exactly the conclusions, and their facts equal the conclusions route's", () => {
    const conclusions = researchConclusions(FILE).conclusions;
    for (const s of body.studies) expect(s.quotable).toBe(s.verdict?.kind === "conclusion");
    expect(body.studies.filter((s) => s.quotable).map((s) => s.id).sort()).toEqual(conclusions.map((c) => c.id).sort());
    for (const c of conclusions) expect(body.studies.find((s) => s.id === c.id)!.facts).toEqual(c.facts);
    expect(body.studies.some((s) => s.verdict?.kind === "noise" && !s.quotable)).toBe(true);
  });

  it("refuses the actual-cost basis", () => {
    expect(() => researchStudies({ ...FILE, costBasis: "actual" })).toThrow(/billed basis/);
  });

  describe("route", () => {
    const original = process.env.DASHBOARD_APP_API_KEY;
    afterEach(() => {
      if (original === undefined) delete process.env.DASHBOARD_APP_API_KEY;
      else process.env.DASHBOARD_APP_API_KEY = original;
    });

    it("answers 401 without the service key, 200 with it", async () => {
      process.env.DASHBOARD_APP_API_KEY = "k-secret";
      expect((await GET(new Request(URL))).status).toBe(401);
      const ok = await GET(new Request(URL, { headers: { "x-api-key": "k-secret" } }));
      expect(ok.status).toBe(200);
      expect((await ok.json()).studies.length).toBe(body.studies.length);
    });
  });
});
