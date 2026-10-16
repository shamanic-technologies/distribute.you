import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOMAIN_BLOCKLIST_PATH, getDomainBlocklist, removalAttemptDetail } from "@/lib/api";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const PAGE = "src/app/(authed)/(dashboard)/audit/cold-email/blocklists/page.tsx";

describe("Cold email > Blocklists", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses the WHOLE prod payload (59 domains, 24 events) through the real reader", async () => {
    const body = read("tests/fixtures/domain-blocklist-prod-2026-10-16.json");
    const fetchSpy = vi.fn(async (_url: string | URL | Request) => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchSpy);
    const data = await getDomainBlocklist(60, "staff-key");
    expect(data.domains.length).toBe(59);
    expect(data.events.length).toBe(24);
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`${DOMAIN_BLOCKLIST_PATH}?days=60`);
  });

  const stubBody = (body: string) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })));

  it("a read that does not serve `failed` yet leaves it absent, never a zero, and draws no Failed series", async () => {
    stubBody(read("tests/fixtures/domain-blocklist-prod-2026-10-16.json"));
    const data = await getDomainBlocklist(60, "staff-key");
    expect(data.series.removalRequests.every((p) => p.failed === undefined)).toBe(true);
    const src = read(PAGE);
    expect(src).toContain('s.removalRequests.every((p) => typeof p.failed === "number")');
    expect(src).toContain('...(servesFailed ? [{ key: "failed", label: "Failed"');
  });

  it("charts removal requests sent and failed per day, and shows why an automated one failed (instantly-service #1190)", async () => {
    const body = JSON.parse(read("tests/fixtures/domain-blocklist-prod-2026-10-16.json"));
    body.series.removalRequests = body.series.removalRequests.map((p: Record<string, unknown>, i: number) => ({ ...p, requested: i % 2, failed: i % 3 === 0 ? 1 : 0 }));
    const base = body.events[0];
    body.events.unshift(
      { ...base, id: "ev-failed", type: "removal_failed", list: "surbl", answer: null, alert: null,
        detail: { method: "automated", attemptId: "a1", outcome: "refused", httpStatus: 200, error: null, answer: "Invalid captcha, please try again" } },
      { ...base, id: "ev-failed-net", type: "removal_failed", list: "surbl", answer: null, alert: null,
        detail: { method: "automated", attemptId: "a2", outcome: "failed", httpStatus: null, error: "owner phone is not set on kevinlourd.com", answer: null } },
      { ...base, id: "ev-sent", type: "removal_requested", list: "surbl", answer: null, alert: null,
        detail: { method: "automated", attemptId: "a3", outcome: "sent", httpStatus: 200, error: null, answer: "Thank you, your request was received" } },
      { ...base, id: "ev-person", type: "removal_requested", list: "spamhaus_dbl", answer: null, alert: null,
        detail: { method: "manual", url: "https://x", note: null } },
    );
    stubBody(JSON.stringify(body));
    const data = await getDomainBlocklist(60, "staff-key");
    expect(data.series.removalRequests[0]).toMatchObject({ requested: 0, failed: 1 });
    const [refused, network, sent, person] = data.events;
    expect(removalAttemptDetail(refused)).toMatchObject({ outcome: "refused", httpStatus: 200, answer: "Invalid captcha, please try again" });
    expect(removalAttemptDetail(network)).toMatchObject({ error: "owner phone is not set on kevinlourd.com", httpStatus: null });
    expect(removalAttemptDetail(sent)).toMatchObject({ outcome: "sent" });
    expect(removalAttemptDetail(person)).toBeNull();

    const src = read(PAGE);
    expect(src).toContain('{ key: "requested", label: "Sent to the list"');
    expect(src).toContain('removal_failed: "Removal request failed"');
    expect(src).toContain("<RemovalAttemptNote event={e} />");
    expect(src).toContain("Why it failed: {d.error ?? d.answer");
    expect(src).toContain("list?.removalAutomated ?");
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
