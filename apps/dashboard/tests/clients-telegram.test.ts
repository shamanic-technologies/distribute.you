import { describe, it, expect, vi } from "vitest";
import {
  buildClientLines,
  clientsMessage,
  parseActiveCustomers,
  parseCustomerBoard,
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
    const text = clientsMessage([{ customer: c, billing, cash: { paidUsd: 523.85, giftedUsd: 0 } }], NOW);
    expect(text).toBe(
      "☀️ 1 active client\n\nShockwavecenters\nDaily $8 · Reactive $0 · Audiences 🟢 · Postpaid · Card 🟢 · Topup 🟢 · $524 invested · next charge $200 in 25 days",
    );
  });

  it("renders a prepaid client with no top-up as its run-out, not a charge", () => {
    const [c] = parseActiveCustomers({ customers: [customer({ orgId: "org-b", brandName: "Olive", runningDailyBudgetUsd: 20 })] });
    const billing = parseFleetOrgs({ orgs: [PREPAID] }).get("org-b")!;
    const text = clientsMessage([{ customer: c, billing, cash: { paidUsd: 0, giftedUsd: 205 } }], NOW);
    expect(text).toContain("Olive\nDaily $20 · Reactive $0 · Audiences 🟢 · Prepaid no topup · Card 🔴 · Topup 🔴 · $0 invested (+$205 free credit) · no charge scheduled, $95 left, runs out in 5 days");
  });

  it("prints ? for what a producer could not serve, never 0", () => {
    const [c] = parseActiveCustomers({ customers: [customer({ audiences: null })] });
    const text = clientsMessage([{ customer: c, billing: null, cash: null }], NOW);
    expect(text).toContain("Audiences ? · Billing ? · invested ?");
  });

  it("flags audiences nearly used up and none left", () => {
    const [near] = parseActiveCustomers({ customers: [customer({ health: { inputs: { audienceNearExhausted: true } } })] });
    const [none] = parseActiveCustomers({ customers: [customer({ audiences: { count: 0, totalRemaining: null } })] });
    expect(clientsMessage([{ customer: near, billing: null, cash: { paidUsd: 1, giftedUsd: 0 } }], NOW)).toContain("Audiences 🟠");
    expect(clientsMessage([{ customer: none, billing: null, cash: { paidUsd: 1, giftedUsd: 0 } }], NOW)).toContain("Audiences 🔴");
  });

  it("orders clients by daily budget, biggest first", () => {
    const [small] = parseActiveCustomers({ customers: [customer({ brandName: "Small", runningDailyBudgetUsd: 5 })] });
    const [big] = parseActiveCustomers({ customers: [customer({ brandName: "Big", runningDailyBudgetUsd: 50 })] });
    const text = clientsMessage([{ customer: small, billing: null, cash: { paidUsd: 1, giftedUsd: 0 } }, { customer: big, billing: null, cash: { paidUsd: 1, giftedUsd: 0 } }], NOW);
    expect(text.indexOf("Big")).toBeLessThan(text.indexOf("Small"));
  });

  it("names clients whose status billing could not resolve, never drops them", () => {
    const board = parseCustomerBoard({
      customers: [customer(), customer({ brandId: "u", brandName: "Mystery", status: "unknown" })],
    });
    expect(board.unknown.map((c) => c.brandName)).toEqual(["Mystery"]);
    const text = clientsMessage([{ customer: board.active[0], billing: null, cash: null }], NOW, board.unknown);
    expect(text.endsWith("⚠️ Status unreadable (billing did not answer): Mystery")).toBe(true);
    expect(clientsMessage([], NOW, board.unknown)).toContain("Mystery");
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
  it("reads staff routes as staff and invested as the org's paid cash, once per org", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchFn = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: init?.headers ?? {} });
      const body = url.includes("customer-success")
        ? { customers: [customer(), customer({ brandId: "brand-a2", brandName: "Second brand" })] }
        : url.includes("revenue/fleet")
          ? { orgs: [POSTPAID] }
          : { credited_paid_cents: "52385.0000000000", credited_gifted_cents: "3700.0000000000" };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const { lines } = await buildClientLines(
      { apiUrl: "https://api.x", adminApiKey: "k", staffEmail: "staff@x", telegramBotToken: "t", telegramChatId: "c" },
      fetchFn as unknown as typeof fetch,
    );
    expect(lines.map((l) => l.cash)).toEqual([{ paidUsd: 523.85, giftedUsd: 37 }, { paidUsd: 523.85, giftedUsd: 37 }]);
    expect(lines[0].billing?.paymentMode).toBe("postpaid");
    expect(calls.find((c) => c.url.includes("customer-success"))!.headers["x-email"]).toBe("staff@x");
    const acct = calls.filter((c) => c.url.endsWith("/v1/billing/accounts"));
    expect(acct).toHaveLength(1);
    expect(acct[0].headers["x-external-org-id"]).toBe("org_A");
    expect(acct[0].headers["x-external-user-id"]).toBe("system-clients-telegram");
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
