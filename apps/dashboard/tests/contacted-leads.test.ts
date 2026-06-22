import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  countContactedLeads,
  localDayInTimeZone,
  bucketContactedByDay,
} from "../src/lib/contacted-leads";
import type { ConversionLead } from "../src/lib/revenue-view";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

function lead(partial: Partial<ConversionLead>): ConversionLead {
  return {
    leadId: partial.leadId ?? "l",
    firstName: null,
    lastName: null,
    photoUrl: null,
    orgName: null,
    orgLogoUrl: null,
    tags: [],
    expectedRevenueUsd: 0,
    date: null,
    ...partial,
  };
}

describe("countContactedLeads", () => {
  it("counts only leads flagged contacted === true", () => {
    const leads = [
      lead({ leadId: "a", contacted: true }),
      lead({ leadId: "b", contacted: false }),
      lead({ leadId: "c", contacted: true, contactedAt: null }),
      lead({ leadId: "d" }), // contacted undefined (field not yet on the wire)
    ];
    expect(countContactedLeads(leads)).toBe(2);
  });

  it("counts a contacted lead even with no contactedAt (date unknown still counts)", () => {
    expect(
      countContactedLeads([lead({ contacted: true, contactedAt: null })]),
    ).toBe(1);
  });
});

describe("localDayInTimeZone", () => {
  it("returns the YYYY-MM-DD local day in the given zone", () => {
    // 2026-06-22T02:30:00Z is still 2026-06-21 in America/Los_Angeles.
    expect(localDayInTimeZone("2026-06-22T02:30:00Z", "America/Los_Angeles")).toBe(
      "2026-06-21",
    );
    expect(localDayInTimeZone("2026-06-22T02:30:00Z", "UTC")).toBe("2026-06-22");
  });

  it("returns null for null/empty/unparseable (NEVER synthesizes a day)", () => {
    expect(localDayInTimeZone(null, "UTC")).toBeNull();
    expect(localDayInTimeZone(undefined, "UTC")).toBeNull();
    expect(localDayInTimeZone("not-a-date", "UTC")).toBeNull();
  });
});

describe("bucketContactedByDay", () => {
  it("buckets contacted leads by their real contactedAt local day", () => {
    const byDay = bucketContactedByDay(
      [
        lead({ leadId: "a", contacted: true, contactedAt: "2026-06-22T10:00:00Z" }),
        lead({ leadId: "b", contacted: true, contactedAt: "2026-06-22T23:00:00Z" }),
        lead({ leadId: "c", contacted: true, contactedAt: "2026-06-21T10:00:00Z" }),
      ],
      "UTC",
    );
    expect(byDay.get("2026-06-22")).toBe(2);
    expect(byDay.get("2026-06-21")).toBe(1);
  });

  it("excludes contacted-but-dateless and non-contacted leads from every bucket", () => {
    const byDay = bucketContactedByDay(
      [
        lead({ leadId: "a", contacted: true, contactedAt: null }),
        lead({ leadId: "b", contacted: false, contactedAt: "2026-06-22T10:00:00Z" }),
        lead({ leadId: "c", contacted: true, contactedAt: "2026-06-22T10:00:00Z" }),
      ],
      "UTC",
    );
    expect(byDay.get("2026-06-22")).toBe(1);
    // the dateless contacted lead is in no bucket
    expect([...byDay.values()].reduce((n, v) => n + v, 0)).toBe(1);
  });
});

describe("single-source wiring (Overview card + graph read /revenue)", () => {
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const parse = read("../src/lib/revenue-parse.ts");
  const view = read("../src/lib/revenue-view.ts");
  const cards = read("../src/components/revenue/outreach-stat-cards.tsx");

  it("parses the new per-lead contacted + contactedAt fields off /revenue", () => {
    expect(parse).toContain("contacted: z.boolean().optional()");
    expect(parse).toContain("contactedAt: z.string().nullish()");
    expect(view).toContain("contacted?: boolean");
    expect(view).toContain("contactedAt?: string | null");
  });

  it("Outreach card count comes from /revenue contacted leads", () => {
    expect(page).toContain("countContactedLeads(data.leads)");
    expect(page).toContain("outreachOverride={contactedLeadCount}");
    expect(cards).toContain("outreachOverride?: number | null");
    // legacy /stats fallback kept for entity pages that don't fetch /revenue
    expect(cards).toContain(
      "outreachOverride ?? stats.leadsContacted ?? stats.recipientsContacted ?? 0",
    );
  });

  it("graph actual outreach is bucketed from /revenue by contactedAt, expected untouched", () => {
    expect(page).toContain("bucketContactedByDay(data.leads, timezone)");
    expect(page).toContain(
      "outreach: { ...day.metrics.outreach, actual: contactedByDay.get(day.date) ?? 0 }",
    );
    expect(page).toContain("pipelineActivity={activityRevealed ? mergedPipelineActivity : undefined}");
    // graph reveals with revenue so the outreach bar never flips backend→/revenue
    expect(page).toContain("data !== undefined");
  });
});
