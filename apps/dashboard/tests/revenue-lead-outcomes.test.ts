import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFeatureRevenue, parseRevenueWithLeads } from "../src/lib/revenue-parse";
import { MAX_PERSISTED_ENTRY_BYTES } from "../src/lib/persist-cache";

/**
 * `/revenue` carries a per-lead array that is 99.6% of its bytes and that NO browser
 * surface needs whole. Measured in prod (brand `75d7e3e8`, 2026-08-31):
 * 10,903,573 bytes total, 10,860,781 of them `leads[]` (9,854 rows), 72 of which carry
 * an outcome. Over the 2MB persisted-cache cap, so the four money reads never reached
 * disk and every card / chart / cost tile riding them cold-skeletoned on every load.
 *
 * These are REAL unit tests: `revenue-parse.ts` imports only zod and a type, so keep it
 * that way — a runtime `@/…` import there turns this file into resolution failures.
 */

/** One lead row in the producer's FULL shape (36 keys on the wire). */
function fatLead(i: number, outcome?: Record<string, unknown>) {
  return {
    leadId: `lead-${i}`,
    firstName: `First${i}`,
    lastName: `Last${i}`,
    photoUrl: `https://cdn.example.test/photos/${i}.jpg`,
    orgName: `Org ${i}`,
    orgLogoUrl: `https://cdn.example.test/logos/${i}.png`,
    orgDomain: `org-${i}.example`,
    tags: ["contacted", "opened"],
    expectedRevenueUsd: 1200,
    // Required-and-nullable on the FULL row (the digest's parse), absent from the slim
    // pick — so a fixture missing it proves the two schemas really do differ.
    date: null,
    contacted: true,
    contactedAt: "2026-08-01T09:00:00.000Z",
    clicked: false,
    clickedAt: null,
    repliedPositive: false,
    repliedPositiveAt: null,
    meetingAttended: false,
    meetingAttendedAt: null,
    signup: false,
    signupAt: null,
    formSubmission: false,
    formSubmissionAt: null,
    meetingBooked: false,
    meetingBookedAt: null,
    purchased: false,
    purchasedAt: null,
    ...outcome,
  };
}

/** The producer's full list — seven outcomes; this surface renders four of them. */
const ALL_ATTRIBUTED = [
  "clicked",
  "repliedPositive",
  "meetingBooked",
  "meetingAttended",
  "signup",
  "formSubmission",
  "purchased",
];

function body(leads: unknown[], attributedOutcomes: string[] = ALL_ATTRIBUTED) {
  return {
    attributedOutcomes,
    featureSlug: "sales-cold-email-outreach",
    headline: { totalPipelineUsd: 7250 },
    costEconomics: {
      committedCostUsd: 2952,
      costOfAcquisitionPct: 41,
      roiMultiple: 2.5,
      costPerAcquisitionUsd: 953,
    },
    timeSeries: [{ date: "2026-08-30", cumulativePipelineUsd: 7250 }],
    organizations: [],
    events: [],
    leads,
  };
}

describe("browser parse drops the leads it cannot use", () => {
  it("keeps only the leads that reached something", () => {
    const leads = [
      fatLead(1),
      fatLead(2, { repliedPositive: true }),
      fatLead(3),
      fatLead(4, { signup: true, signupAt: "2026-08-30T10:00:00.000Z" }),
    ];
    const parsed = parseFeatureRevenue(body(leads), "test");
    expect(parsed.leadOutcomes.map((l) => l.leadId)).toEqual(["lead-2", "lead-4"]);
  });

  it("never carries a lead's identity — only its id and what it reached", () => {
    const parsed = parseFeatureRevenue(body([fatLead(1, { clicked: true })]), "test");
    expect(Object.keys(parsed.leadOutcomes[0]).sort()).toEqual([
      "clicked",
      "formSubmission",
      "formSubmissionAt",
      "leadId",
      "meetingAttended",
      "meetingBooked",
      "meetingBookedAt",
      "purchased",
      "purchasedAt",
      "repliedPositive",
      "signup",
      "signupAt",
    ]);
  });

  it("carries no `leads` array at all on the browser shape", () => {
    const parsed = parseFeatureRevenue(body([fatLead(1, { clicked: true })]), "test");
    expect("leads" in parsed).toBe(false);
  });

  it("reads a FALSE flag as measured-and-did-not-happen, so the row is dropped", () => {
    const parsed = parseFeatureRevenue(body([fatLead(1)]), "test");
    expect(parsed.leadOutcomes).toEqual([]);
  });

  it("does not validate the fields it drops — a rotten name cannot break the page", () => {
    const rotten = { ...fatLead(1, { clicked: true }), firstName: 42, tags: "nope" };
    expect(() => parseFeatureRevenue(body([rotten]), "test")).not.toThrow();
  });

  it("still fails loud when a field it DOES read is the wrong type", () => {
    const rotten = { ...fatLead(1), leadId: 42 };
    expect(() => parseFeatureRevenue(body([rotten]), "test")).toThrow(
      /invalid revenue response shape/,
    );
  });
});

describe("outcomeFieldsServed prefers the producer's own answer", () => {
  it("narrows the producer's seven to the four this surface renders", () => {
    const raw = body([fatLead(1)], [
      "clicked",
      "repliedPositive",
      "meetingBooked",
      "meetingAttended",
      "signup",
    ]);
    expect(parseFeatureRevenue(raw, "test").outcomeFieldsServed).toEqual([
      "signup",
      "meetingBooked",
    ]);
  });

  it("keeps an outcome attributed on a brand where NOBODY has reached anything", () => {
    // The case a derivation off `leads[]` cannot answer now that the producer narrows
    // server-side: zero outcome-carrying rows, tracker live. Derived this reads [] and
    // the Leads page drops every outcome tab; served, the tabs survive.
    const parsed = parseFeatureRevenue(body([], ["signup", "purchased"]), "test");
    expect(parsed.leadOutcomes).toEqual([]);
    expect(parsed.outcomeFieldsServed).toEqual(["signup", "purchased"]);
  });

  it("trusts an EMPTY list — that is the producer saying it read no leads at all", () => {
    expect(parseFeatureRevenue(body([fatLead(1)], []), "test").outcomeFieldsServed).toEqual(
      [],
    );
  });

  it("does not infer attribution from the rows, even when they carry the key", () => {
    // Every lead carries `signup: false`, and the producer says it cannot attribute it.
    // The producer wins: a key on a row is not a statement that it is measured.
    const parsed = parseFeatureRevenue(
      body([fatLead(1), fatLead(2)], ["clicked", "repliedPositive"]),
      "test",
    );
    expect(parsed.outcomeFieldsServed).toEqual([]);
  });

  it("fails loud when the producer does not say — never falls back to a derivation", () => {
    // Required on the wire from features-service v0.153.0. A body without it is shape
    // rot, and the old fallback would have answered confidently and wrongly.
    const withoutField = body([fatLead(1)]) as Record<string, unknown>;
    delete withoutField.attributedOutcomes;
    expect(() => parseFeatureRevenue(withoutField, "test")).toThrow(
      /invalid revenue response shape/,
    );
  });
});

describe("the digest asks for the people it names", () => {
  it("sends leads=full, because its parse requires the hydrated fields", () => {
    const digest = readFileSync(
      join(process.cwd(), "src/lib/outcome-digest.ts"),
      "utf8",
    );
    expect(digest).toContain('leads: "full"');
  });

  it("is the ONLY reader that asks — every browser read takes the narrow default", () => {
    const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");
    expect(api).not.toContain("leads=full");
    expect(api).not.toContain('leads: "full"');
  });
});

describe("the digest keeps the whole array", () => {
  it("returns every lead, hydrated", () => {
    const parsed = parseRevenueWithLeads(body([fatLead(1), fatLead(2)]), "digest");
    expect(parsed.leads).toHaveLength(2);
    expect(parsed.leads[0].firstName).toBe("First1");
    // ...and still narrows, so the two views of one body cannot disagree.
    expect(parsed.leadOutcomes).toEqual([]);
  });

  it("fails loud when the producer stops sending them", () => {
    const withoutLeads = body([]) as Record<string, unknown>;
    delete withoutLeads.leads;
    expect(() => parseRevenueWithLeads(withoutLeads, "digest")).toThrow(
      /invalid revenue response shape/,
    );
  });
});

describe("the persisted snapshot fits on disk", () => {
  it("stays far under the cache cap at the population that broke it", () => {
    // 9,854 leads, 72 of them carrying an outcome — the prod shape, to scale.
    const leads = Array.from({ length: 9854 }, (_, i) =>
      i % 137 === 0 ? fatLead(i, { repliedPositive: true }) : fatLead(i),
    );
    const raw = JSON.stringify(body(leads));
    expect(raw.length).toBeGreaterThan(MAX_PERSISTED_ENTRY_BYTES);

    const parsed = parseFeatureRevenue(body(leads), "test");
    // What the persister actually writes: `{state:{data}, queryKey, queryHash, buster}`.
    const snapshot = JSON.stringify({
      state: { data: parsed, dataUpdatedAt: 0 },
      queryKey: ["brandRevenue", "brand-1"],
      queryHash: '["brandRevenue","brand-1"]',
      buster: "1",
    });
    expect(snapshot.length).toBeLessThan(MAX_PERSISTED_ENTRY_BYTES);
  });
});

describe("no browser surface reads the full lead array", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("routes every dashboard revenue reader through the leadless parse", () => {
    const api = read("src/lib/api.ts");
    expect(api).not.toContain("parseRevenueWithLeads");
    expect((api.match(/parseFeatureRevenue\(/g) ?? []).length).toBe(4);
  });

  it("keeps the full array to the digest, which runs server-side", () => {
    const digest = read("src/lib/outcome-digest.ts");
    expect(digest).toContain("parseRevenueWithLeads(raw,");
    expect(digest).not.toContain("parseFeatureRevenue(");
  });

  it("has both per-lead consumers read the narrowed list", () => {
    for (const p of [
      "src/components/audiences/engaged-leads-page.tsx",
      "src/components/funnels/funnel-leg-page.tsx",
    ]) {
      const src = read(p);
      expect(src).toContain("leadOutcomes");
      expect(src).not.toMatch(/revenue(Data)?[.?]*\.data\?\.leads\b/);
      expect(src).not.toContain("revenueData?.leads");
    }
  });

  it("gates the outcome tab on the served fields, not on the narrowed rows", () => {
    const src = read("src/components/audiences/engaged-leads-page.tsx");
    expect(src).toContain("outcomeFieldsServed");
    expect(src).not.toContain("l[t.leadField] !== undefined");
  });
});
