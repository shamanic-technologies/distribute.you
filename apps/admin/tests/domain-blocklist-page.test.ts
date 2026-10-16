import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOMAIN_BLOCKLIST_PATH, getDomainBlocklist } from "@/lib/api";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const PAGE = "src/app/(authed)/(dashboard)/audit/cold-email/blocklists/page.tsx";

describe("Cold email > Blocklists", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses the WHOLE prod payload (59 domains, 24 events) through the real reader", async () => {
    const body = read("tests/fixtures/domain-blocklist-prod-2026-10-16.json");
    const fetchSpy = vi.fn(async () => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchSpy);
    const data = await getDomainBlocklist(60, "staff-key");
    expect(data.domains.length).toBe(59);
    expect(data.events.length).toBe(24);
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`${DOMAIN_BLOCKLIST_PATH}?days=60`);
  });

  it("reads the gateway's staff instantly ops family", () => {
    expect(DOMAIN_BLOCKLIST_PATH).toBe("/instantly/ops/domain-blocklist");
  });

  it("draws one chart per monitored sub-topic, each off its served series (owner rule 2026-10-16)", () => {
    const src = read(PAGE);
    for (const series of [
      "s.domainsListed",
      "s.mailboxesOutOfNewSequences",
      "s.sendsFromListedDomains",
      "s.blocklistBounces",
      "s.removalRequests",
      "s.delistings",
    ]) {
      expect(src, series).toContain(series);
    }
    expect(src).toContain("<BlocklistDailyChart");
  });

  it("a day before the first check draws no bar and says so, never a zero", () => {
    const chart = read("src/components/audit/blocklist-daily-chart.tsx");
    expect(chart).toContain("Not checked yet");
    const src = read(PAGE);
    expect(src).toContain("p.byList ? (p.byList[k.key] ?? 0) : null");
  });

  it("records a removal a person filed, never files it", () => {
    const src = read(PAGE);
    expect(src).toContain("recordDomainBlocklistRemovalRequest");
    expect(src).toContain("list.removalUrl");
  });
});
