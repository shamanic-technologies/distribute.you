import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Brand-overview metric cards now source ALL FOUR metrics from AhrefService and
 * trigger an on-demand fetch when a domain has never been scraped
 * ("getOrFetchIfNeverSeen", DIS-222 follow-up). These guards pin the wire
 * contract (the 3 locked api-service proxy paths) and the component wiring so a
 * refactor can't silently drop the trigger or revert card 4 to the old
 * ai-visibility-score-service source.
 */
const apiSrc = fs.readFileSync(
  path.join(__dirname, "../src/lib/api.ts"),
  "utf-8",
);
const headerSrc = fs.readFileSync(
  path.join(__dirname, "../src/components/brand-metrics-header.tsx"),
  "utf-8",
);

describe("api.ts — on-demand Ahrefs compute helpers", () => {
  it("exports the three compute helpers", () => {
    expect(apiSrc).toContain("export async function computeDomainTraffic");
    expect(apiSrc).toContain("export async function computeDomainDr");
    expect(apiSrc).toContain("export async function computeDomainAiVisibility");
  });

  it("POSTs to the locked api-service proxy paths (byte-equal contract)", () => {
    expect(apiSrc).toContain('apiCall<unknown>("/orgs/domains/traffic-compute"');
    expect(apiSrc).toContain('apiCall<unknown>("/orgs/domains/dr-compute"');
    expect(apiSrc).toContain('apiCall<unknown>("/orgs/domains/ai-visibility"');
    expect(apiSrc).toContain('method: "POST"');
  });

  it("sends the documented request bodies", () => {
    // traffic + DR take a domains array; ai-visibility takes a single domain.
    expect(apiSrc).toContain("body: { domains }");
    expect(apiSrc).toContain("body: { domain }");
  });

  it("validates ai-visibility response shape (fail-loud, no fallback)", () => {
    expect(apiSrc).toContain("const DomainAiVisibilitySchema");
    expect(apiSrc).toContain("mentionsTotal: z.number()");
    expect(apiSrc).toContain(
      "[dashboard] computeDomainAiVisibility: invalid response shape",
    );
  });

  it("exposes a read-only GET cache reader for ai-visibility (fast, no scrape)", () => {
    expect(apiSrc).toContain("export async function getDomainAiVisibility");
    // GET reads the cache via ?domains= (array) and takes the first element.
    expect(apiSrc).toContain("`/orgs/domains/ai-visibility?domains=");
    expect(apiSrc).toContain(
      "[dashboard] getDomainAiVisibility: invalid response shape",
    );
  });
});

describe("brand-metrics-header.tsx — getOrFetchIfNeverSeen wiring", () => {
  it("fires the on-demand compute once per never-seen domain", () => {
    expect(headerSrc).toContain("useGetOrFetchIfNeverSeen");
    expect(headerSrc).toContain("computeDomainTraffic");
    expect(headerSrc).toContain("computeDomainDr");
    // localStorage marker bounds a genuinely-empty domain to a single paid scrape.
    expect(headerSrc).toContain("ahref-compute-tried");
  });

  it("writes the compute result back into the read cache", () => {
    expect(headerSrc).toContain("qc.setQueryData");
  });

  it("card 4 reads Ahrefs Brand-Radar AI mentions, not the old visibility-score runs", () => {
    expect(headerSrc).toContain("computeDomainAiVisibility");
    expect(headerSrc).toContain('title="AI mentions"');
    expect(headerSrc).toContain("mentionsTotal");
    // Old source must be gone — card 4 is AhrefService now.
    expect(headerSrc).not.toContain("listVisibilityRuns");
    expect(headerSrc).not.toContain("brandMentionRate");
  });

  it("card 4 DISPLAY query is the fast GET; the scrape POST stays off the render path (regression)", () => {
    // The ai-visibility POST scrapes Apify inline. It must NOT be the card's render
    // query — a slow POST in the reveal barrier once froze all four cards ("shows
    // nothing"). Card 4 now displays the fast GET cache read; the POST is fired only
    // as a background getOrFetchIfNeverSeen trigger, so every barrier flag is a fast
    // cache GET and ai-visibility is barrier-safe.
    expect(headerSrc).toContain("getDomainAiVisibility(domain as string)");
    const barrier = headerSrc.match(/useCoordinatedReveal\(\[[\s\S]*?\]/)?.[0] ?? "";
    expect(barrier).toContain("trafficPending");
    expect(barrier).toContain("drPending");
    expect(barrier).toContain("aiVisPending");
    // The POST is only a getOrFetch compute (metric "aivis"), never a render query.
    expect(headerSrc).toContain('metric: "aivis"');
    expect(headerSrc).not.toContain("() => computeDomainAiVisibility(");
  });

  it("charts only render from 3+ historical points on unique dates", () => {
    expect(headerSrc).toContain("MIN_HISTORICAL_UNIQUE_DAYS = 3");
    expect(headerSrc).toContain("uniqueDatedSeries");
    expect(headerSrc).toContain("toIsoDay");
    expect(headerSrc).toContain("visitsSeries.length >= MIN_HISTORICAL_UNIQUE_DAYS");
  });
});
