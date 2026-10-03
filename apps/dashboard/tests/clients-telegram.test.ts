import { describe, it, expect, vi } from "vitest";
import {
  buildClientLines,
  clientsMessage,
  parseActiveCustomers,
  parseFleetOrgs,
  relativeDays,
  splitForTelegram,
} from "../src/lib/clients-telegram";

const NOW = new Date("2026-10-03T05:00:00.000Z");

// Shapes copied from the prod reads on 2026-10-03 (trimmed to what the message uses).
function customer(over: Record<string, unknown> = {}) {
  return {
    orgId: "org-a",
    orgExternalId: "org_A",
    brandId: "brand-a",
    brandName: "Shockwavecenters",
    brandDomain: "shockwavecenters.com",
    status: "active",
    runningDailyBudgetUsd: 8,
    reactiveRunningDailyCapUsd: 0,
    audiences: { count: 18, totalSize: 23171, totalRemaining: 14159, pctUsed: 38.9 },
    health: { badge: "green", inputs: { audienceNearExhausted: false } },
    ...over,
  };
}

const POSTPAID = {
  orgId: "org-a",
  paymentMode: "postpaid",
  chargeableCard: true,
  autoTopupEnabled: true,
  cashState: "will_charge",
  cashBlockedReason: null,
  cashEvents: [{ at: "2026-10-28T06:50:41.290Z", trigger: "floor", expectedAmountCents: "20000" }],
  oneOff: null,
};

const PREPAID = {
  orgId: "org-b",
  paymentMode: "prepaid",
  chargeableCard: false,
  autoTopupEnabled: false,
  cashState: "no_autopay",
  cashBlockedReason: null,
  cashEvents: [],
  oneOff: { remainingCents: "9487.2566240280", dailyPaceCents: "2000", runOutAt: "2026-10-07T22:00:16.820Z", runOutUnknownReason: null },
};

describe("clients telegram message", () => {
  it("keeps only the producer's active verdict", () => {
    const rows = parseActiveCustomers({ customers: [customer(), customer({ brandId: "x", status: "paused" })] });
    expect(rows.map((r) => r.brandId)).toEqual(["brand-a"]);
  });

  it("renders a postpaid client with the next charge", () => {
    const [c] = parseActiveCustomers({ customers: [customer()] });
    const billing = parseFleetOrgs({ orgs: [POSTPAID] }).get("org-a")!;
    const text = clientsMessage([{ customer: c, billing, investedUsd: 570.78 }], NOW);
    expect(text).toBe(
      "☀️ 1 active client\n\nShockwavecenters\nDaily $8 · Reactive $0 · Audiences 🟢 · Postpaid · Card 🟢 · Topup 🟢 · $571 invested · next charge $200 in 25 days",
    );
  });

  it("renders a prepaid client with no top-up as its run-out, not a charge", () => {
    const [c] = parseActiveCustomers({ customers: [customer({ orgId: "org-b", brandName: "Olive", runningDailyBudgetUsd: 20 })] });
    const billing = parseFleetOrgs({ orgs: [PREPAID] }).get("org-b")!;
    const text = clientsMessage([{ customer: c, billing, investedUsd: 82.05 }], NOW);
    expect(text).toContain("Olive\nDaily $20 · Reactive $0 · Audiences 🟢 · Prepaid no topup · Card 🔴 · Topup 🔴 · $82 invested · no charge scheduled, $95 left, runs out in 5 days");
  });

  it("prints ? for what a producer could not serve, never 0", () => {
    const [c] = parseActiveCustomers({ customers: [customer({ audiences: null })] });
    const text = clientsMessage([{ customer: c, billing: null, investedUsd: null }], NOW);
    expect(text).toContain("Audiences ? · Billing ? · invested ?");
  });

  it("flags audiences nearly used up and none left", () => {
    const [near] = parseActiveCustomers({ customers: [customer({ health: { inputs: { audienceNearExhausted: true } } })] });
    const [none] = parseActiveCustomers({ customers: [customer({ audiences: { count: 0, totalRemaining: null } })] });
    expect(clientsMessage([{ customer: near, billing: null, investedUsd: 1 }], NOW)).toContain("Audiences 🟠");
    expect(clientsMessage([{ customer: none, billing: null, investedUsd: 1 }], NOW)).toContain("Audiences 🔴");
  });

  it("orders clients by daily budget, biggest first", () => {
    const [small] = parseActiveCustomers({ customers: [customer({ brandName: "Small", runningDailyBudgetUsd: 5 })] });
    const [big] = parseActiveCustomers({ customers: [customer({ brandName: "Big", runningDailyBudgetUsd: 50 })] });
    const text = clientsMessage([{ customer: small, billing: null, investedUsd: 1 }, { customer: big, billing: null, investedUsd: 1 }], NOW);
    expect(text.indexOf("Big")).toBeLessThan(text.indexOf("Small"));
  });

  it("says so when nobody is active", () => {
    expect(clientsMessage([], NOW)).toBe("☀️ No active clients this morning.");
  });

  it("relative days", () => {
    expect(relativeDays("2026-10-03T20:00:00Z", NOW)).toBe("today");
    expect(relativeDays("2026-10-04T05:00:00Z", NOW)).toBe("tomorrow");
  });

  it("splits long messages on client boundaries under Telegram's cap", () => {
    const blocks = Array.from({ length: 60 }, (_, i) => `Brand ${i}\n${"x".repeat(100)}`);
    const chunks = splitForTelegram(blocks.join("\n\n"));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(4000);
    expect(chunks.join("\n\n")).toBe(blocks.join("\n\n"));
  });
});

describe("clients telegram reads", () => {
  it("reads staff routes as staff and invested at pricing=net under the job identity", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchFn = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: init?.headers ?? {} });
      const body = url.includes("customer-success")
        ? { customers: [customer()] }
        : url.includes("revenue/fleet")
          ? { orgs: [POSTPAID] }
          : { costEconomics: { committedCostUsd: 570.78 } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const lines = await buildClientLines(
      { apiUrl: "https://api.x", adminApiKey: "k", staffEmail: "staff@x", telegramBotToken: "t", telegramChatId: "c" },
      fetchFn as unknown as typeof fetch,
    );
    expect(lines[0].investedUsd).toBe(570.78);
    expect(lines[0].billing?.paymentMode).toBe("postpaid");
    const staff = calls.find((c) => c.url.includes("customer-success"))!;
    expect(staff.headers["x-email"]).toBe("staff@x");
    const rev = calls.find((c) => c.url.includes("/revenue?"))!;
    expect(rev.url).toContain("pricing=net");
    expect(rev.headers["x-external-org-id"]).toBe("org_A");
    expect(rev.headers["x-external-user-id"]).toBe("system-clients-telegram");
  });

  it("fails loud when a staff read fails", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 403 }));
    await expect(
      buildClientLines(
        { apiUrl: "https://api.x", adminApiKey: "k", staffEmail: "s", telegramBotToken: "t", telegramChatId: "c" },
        fetchFn as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/403/);
  });
});
