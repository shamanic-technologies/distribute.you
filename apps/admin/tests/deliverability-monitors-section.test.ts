import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED_PLACEMENT_DAILY_PATH, SENDER_HEALTH_PATH, getSeedPlacementDaily, getSenderHealth } from "@/lib/api";
import { latestInboxPct, latestSenderHealthDay } from "@/components/audit/deliverability-monitors-section";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

function serve(body: string, status = 200) {
  const spy = vi.fn(async (_url: string | URL | Request) => new Response(body, { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("Blocklists > deliverability monitors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses the WHOLE prod seed-placement payload; Outlook.com is its own series", async () => {
    const spy = serve(read("tests/fixtures/seed-placement-daily-prod-2026-10-19.json"));
    const data = await getSeedPlacementDaily(60, "staff-key");
    expect(data.days).toHaveLength(60);
    expect(String(spy.mock.calls[0][0])).toContain(`${SEED_PLACEMENT_DAILY_PATH}?days=60`);
    expect(latestInboxPct(data, "google")).toBe("32.3% on Oct 19");
    expect(latestInboxPct(data, "microsoft")).toBe("33.6% on Oct 19");
    expect(latestInboxPct(data, "microsoftConsumer")).toBe("7.6% on Oct 19");
  });

  it("parses the WHOLE prod sender-health payload; no tick yet reads as none, never zero", async () => {
    const spy = serve(read("tests/fixtures/sender-health-prod-2026-10-19.json"));
    const data = await getSenderHealth(60, "staff-key");
    expect(String(spy.mock.calls[0][0])).toContain(`${SENDER_HEALTH_PATH}?days=60`);
    expect(data.days).toHaveLength(60);
    expect(latestSenderHealthDay(data)).toBeNull();
  });

  it("picks the latest ticked day of sender health", async () => {
    serve(
      JSON.stringify({
        asOf: "2026-10-20T10:00:00.000Z",
        from: "2026-10-19",
        to: "2026-10-20",
        current: null,
        days: [
          { day: "2026-10-19", refusedMailboxes: 2, mostlySpamMailboxes: { google: 1, microsoft: 0, microsoft_consumer: 3 }, heldPlacement: 0, heldMostlySpam: 0, skippedRefused: 0 },
          { day: "2026-10-20", refusedMailboxes: null, mostlySpamMailboxes: null, heldPlacement: null, heldMostlySpam: null, skippedRefused: null },
        ],
      }),
    );
    const data = await getSenderHealth(2);
    expect(latestSenderHealthDay(data)?.day).toBe("2026-10-19");
  });

  it("fails loud on a payload missing a provider series", async () => {
    const body = JSON.parse(read("tests/fixtures/seed-placement-daily-prod-2026-10-19.json"));
    delete body.days[0].microsoftConsumer;
    serve(JSON.stringify(body));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getSeedPlacementDaily(60)).rejects.toThrow("invalid response shape");
    err.mockRestore();
  });

  it("reads the gateway paths api-service serves", () => {
    expect(SEED_PLACEMENT_DAILY_PATH).toBe("/instantly/ops/seed-placement/daily");
    expect(SENDER_HEALTH_PATH).toBe("/instantly/ops/sender-health");
  });

  it("one chart per provider and per cut reason, mounted on the Blocklists page", () => {
    const src = read("src/components/audit/deliverability-monitors-section.tsx");
    for (const t of ["Inbox rate at Google", "Inbox rate at Microsoft 365", "Inbox rate at Outlook.com", "Refused by the mail server", "Mostly in spam, by provider"]) {
      expect(src, t).toContain(t);
    }
    expect(read("src/app/(authed)/(dashboard)/audit/cold-email/blocklists/page.tsx")).toContain(
      "<DeliverabilityMonitorsSection days={days} />",
    );
  });
});
