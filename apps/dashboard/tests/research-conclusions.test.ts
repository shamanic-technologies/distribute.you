import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { researchConclusions } from "../src/lib/research/conclusions";
import type { ResearchFile, ResearchStudy } from "../src/lib/research/research";
import { verifyServiceKey } from "../src/lib/service-key";
import { GET } from "../src/app/api/internal/research/conclusions/route";

const FILE: ResearchFile = JSON.parse(readFileSync(join(__dirname, "..", "src", "lib", "research", "research.json"), "utf8"));
const URL = "https://dashboard.example.test/api/internal/research/conclusions";

describe("research conclusions: what a backend service may quote", () => {
  const body = researchConclusions(FILE);
  const served = new Set(body.conclusions.map((c) => c.id));

  it("serves every measured conclusion and nothing else", () => {
    const expected = FILE.studies.filter((s) => s.status === "measured" && s.verdict?.kind === "conclusion").map((s) => s.id);
    expect(expected.length).toBeGreaterThan(0);
    expect([...served].sort()).toEqual([...expected].sort());
    for (const s of FILE.studies) {
      if (s.verdict?.kind === "signal" || s.verdict?.kind === "noise") expect(served.has(s.id)).toBe(false);
    }
  });

  it("copies the page's strings verbatim (headline, reason, result, chart notes)", () => {
    for (const c of body.conclusions) {
      const s = FILE.studies.find((x) => x.id === c.id) as ResearchStudy;
      expect(c.headline).toBe(s.headline);
      expect(c.verdict).toEqual({ kind: "conclusion", reason: s.verdict!.reason });
      expect(c.result).toEqual(s.result);
      const notes = new Set(s.charts.flatMap((ch) => [...ch.points, ...(ch.cumulative?.points ?? [])]).map((p) => p.note));
      for (const f of c.facts) if (f.sample !== null && f.sample !== s.result?.sample) expect(notes.has(f.sample)).toBe(true);
    }
  });

  it("leaves Learning points and valueless buckets out", () => {
    const study: ResearchStudy = {
      id: "t", crew: "scout", topic: "layout", goal: "roi", question: "q?", status: "measured", headline: "h", winner: "A", crowned: true,
      verdict: { kind: "conclusion", reason: "A beats B" },
      result: { display: "$2", unit: "per website visit", sample: "10 website visits · 100 emails" },
      charts: [{ kind: "bars", title: "Cost", lowerIsBetter: true, points: [
        { label: "A", value: 2, display: "$2", note: "10 website visits · 100 emails", thin: false },
        { label: "B", value: 9, display: "$9", note: "3 website visits · 50 emails", thin: true },
        { label: "C", value: 0, display: "None yet", note: "0 website visits · 4 emails", thin: false },
      ] }],
      conclusion: [],
    };
    const out = researchConclusions({ ...FILE, studies: [study] });
    const statements = out.conclusions[0].facts.map((f) => f.statement).join("\n");
    expect(statements).toContain("Cost: A, $2");
    expect(statements).not.toContain("Cost: B");
    expect(statements).not.toContain("Cost: C");
  });

  it("names the outcome in plain words, never a crew", () => {
    for (const c of body.conclusions) expect(["Positive reply", "Website visit", "Meeting booked"]).toContain(c.outcome);
    expect(JSON.stringify(body)).not.toMatch(/"crew"/);
  });

  it("refuses the vendor-cost basis", () => {
    expect(() => researchConclusions({ ...FILE, costBasis: "actual" })).toThrow(/billed basis/);
  });
});

describe("the service key", () => {
  const original = process.env.DASHBOARD_APP_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.DASHBOARD_APP_API_KEY;
    else process.env.DASHBOARD_APP_API_KEY = original;
  });

  it("fails loud when DASHBOARD_APP_API_KEY is not configured", () => {
    delete process.env.DASHBOARD_APP_API_KEY;
    expect(() => verifyServiceKey(new Request(URL))).toThrow("DASHBOARD_APP_API_KEY is required");
  });

  it("accepts only the exact key", () => {
    process.env.DASHBOARD_APP_API_KEY = "k-secret";
    expect(verifyServiceKey(new Request(URL))).toBe(false);
    expect(verifyServiceKey(new Request(URL, { headers: { "x-api-key": "k-secre" } }))).toBe(false);
    expect(verifyServiceKey(new Request(URL, { headers: { "x-api-key": "wrong-key" } }))).toBe(false);
    expect(verifyServiceKey(new Request(URL, { headers: { "x-api-key": "k-secret" } }))).toBe(true);
  });

  it("the route refuses a request without the key and serves the conclusions with it", async () => {
    process.env.DASHBOARD_APP_API_KEY = "k-secret";
    const refused = await GET(new Request(URL));
    expect(refused.status).toBe(401);
    const ok = await GET(new Request(URL, { headers: { "x-api-key": "k-secret" } }));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.conclusions.length).toBeGreaterThan(0);
    expect(body.conclusions.every((c: { verdict: { kind: string } }) => c.verdict.kind === "conclusion")).toBe(true);
  });

  it("the route answers 500 when the key is not configured, never an open route", async () => {
    delete process.env.DASHBOARD_APP_API_KEY;
    const res = await GET(new Request(URL, { headers: { "x-api-key": "anything" } }));
    expect(res.status).toBe(500);
  });
});

describe("the edge lets the service call through to the route's own key check", () => {
  it("/api/internal is a public route in proxy.ts", () => {
    expect(readFileSync(join(__dirname, "..", "src", "proxy.ts"), "utf8")).toContain('"/api/internal(.*)"');
  });
});
