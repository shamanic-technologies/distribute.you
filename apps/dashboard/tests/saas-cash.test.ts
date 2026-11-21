import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  cumulativeGrossPoints,
  fetchSaasCash,
  parseSaasCash,
  saasCashCaption,
  saasCashCharts,
  sendSaasCashTelegram,
  weeklyGrossPoints,
} from "../src/lib/saas-cash";

const fig = (g: number, n: number, a: number) => ({
  saasGrossCents: Math.round(g * 100),
  saasGrossUsd: g,
  saasNetCents: Math.round(n * 100),
  saasNetUsd: n,
  withAgencyGrossCents: Math.round(a * 100),
  withAgencyGrossUsd: a,
});

// Shape of features-service `GET /internal/stats/saas-cash` (prod figures, 2026-11-21).
const body = {
  computedAt: "2026-11-21T08:00:00.000Z",
  asOf: "2026-11-21T08:00:00.000Z",
  basis: {},
  firstPaymentDay: "2026-11-09",
  weeks: [
    { isoWeek: "2026-W46", weekStart: "2026-11-09", isCurrent: false, ...fig(3713.37, 3529.05, 8513.52) },
    { isoWeek: "2026-W47", weekStart: "2026-11-16", isCurrent: true, ...fig(25, 20, 25) },
  ],
  days: [
    { day: "2026-11-19", isCurrent: false, cash: fig(0, 0, 0), cumulative: fig(3713.37, 3529.05, 8513.52) },
    { day: "2026-11-20", isCurrent: false, cash: fig(25, 20, 25), cumulative: fig(3738.37, 3549.05, 8538.52) },
    { day: "2026-11-21", isCurrent: true, cash: fig(0, 0, 0), cumulative: fig(3738.37, 3549.05, 8538.52) },
  ],
  totals: { thisWeek: fig(25, 20, 25), sinceInception: fig(3738.37, 3549.05, 8538.52) },
  reconciliation: {},
  excludedOrgs: [],
  saasOrgsWithoutVerdict: [],
  payingSaasOrgs: 4,
};

describe("saas cash reader", () => {
  it("maps served weeks and served running totals, SaaS gross only", () => {
    const cash = parseSaasCash(body);
    expect(weeklyGrossPoints(cash)).toEqual([
      { start: "2026-11-09", usd: 3713.37, current: false },
      { start: "2026-11-16", usd: 25, current: true },
    ]);
    expect(cumulativeGrossPoints(cash).map((p) => p.usd)).toEqual([3713.37, 3738.37, 3738.37]);
    expect(cumulativeGrossPoints(cash).at(-1)?.current).toBe(true);
  });

  it("fails loud on a missing served field, never a zero", () => {
    const broken = structuredClone(body) as Record<string, unknown>;
    (broken.totals as Record<string, Record<string, unknown>>).thisWeek.saasGrossUsd = undefined;
    expect(() => parseSaasCash(broken)).toThrow(/saas-cash/);
    expect(() => parseSaasCash({ ...body, days: undefined })).toThrow(/saas-cash/);
  });

  it("captions gross ex-agency first, then net, then with agency", () => {
    const caption = saasCashCaption(parseSaasCash(body));
    const lines = caption.split("\n");
    expect(lines[0]).toContain("SaaS cash collected (gross): $25 this week, $3,738 since inception");
    expect(lines[1]).toBe("Net of refunds: $20 this week, $3,549 since inception");
    expect(lines[2]).toBe("With agency (gross): $25 this week, $8,539 since inception");
    expect(caption).not.toMatch(/[—–]/);
    expect(caption.length).toBeLessThan(1024); // Telegram caption cap
  });

  it("charts carry the gross headline figures", () => {
    const { weeklySvg, cumulativeSvg } = saasCashCharts(parseSaasCash(body));
    expect(weeklySvg).toContain("$25 this week");
    expect(cumulativeSvg).toContain("$3,738 since inception");
    expect(weeklySvg).toContain('stroke-dasharray="6 4"');
    expect(cumulativeSvg).toContain('stroke-dasharray="7 5"');
  });
});

describe("saas cash IO", () => {
  it("reads the staff gateway route with the admin key and a staff email", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    await fetchSaasCash({ apiUrl: "https://api.test", adminApiKey: "k", staffEmail: "s@x.test" }, fetchFn as unknown as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/v1/features/audit/saas-cash");
    expect(init.headers).toEqual({ "X-API-Key": "k", "x-email": "s@x.test" });
  });

  it("throws on a non-2xx read", async () => {
    const fetchFn = vi.fn(async () => new Response("boom", { status: 502 }));
    await expect(
      fetchSaasCash({ apiUrl: "https://api.test", adminApiKey: "k", staffEmail: "s" }, fetchFn as unknown as typeof fetch),
    ).rejects.toThrow(/502/);
  });

  it("sends both PNGs as one album to the owner chat, caption on the first", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    await sendSaasCashTelegram(
      { telegramBotToken: "T", telegramChatId: "42" },
      "cap",
      { weekly: new Uint8Array([1]), cumulative: new Uint8Array([2]) },
      fetchFn as unknown as typeof fetch,
    );
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/botT/sendMediaGroup");
    const form = init.body as FormData;
    expect(form.get("chat_id")).toBe("42");
    expect(JSON.parse(form.get("media") as string)).toEqual([
      { type: "photo", media: "attach://weekly", caption: "cap" },
      { type: "photo", media: "attach://cumulative" },
    ]);
    expect(form.get("weekly")).toBeInstanceOf(Blob);
    expect(form.get("cumulative")).toBeInstanceOf(Blob);
  });

  it("the cron route lives under the public /api/cron prefix and checks the cron bearer", () => {
    const route = fs.readFileSync(path.join(__dirname, "../src/app/api/cron/saas-cash-telegram/route.ts"), "utf8");
    expect(route).toContain("verifyStaffDigestCronRequest(req)");
    expect(route).toContain("TELEGRAM_OWNER_CHAT_ID");
  });
});
