import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { buildCreditGrantBody, todayIsoDate } from "../src/lib/credit-grant-body";

describe("credit grant body", () => {
  it("a gift carries no paidOffPlatformAt key at all", () => {
    const body = buildCreditGrantBody({ amountCents: 5000, note: "goodwill", idempotencyKey: "k1", paidOffPlatformAt: null });
    expect(body).toEqual({ amountCents: 5000, note: "goodwill", idempotencyKey: "k1" });
    expect("paidOffPlatformAt" in body).toBe(false);
  });

  it("a payment the client made directly sends paidOffPlatformAt as the day paid", () => {
    expect(
      buildCreditGrantBody({ amountCents: 20000, note: "Bank transfer", idempotencyKey: "k2", paidOffPlatformAt: "2026-09-28" }),
    ).toEqual({ amountCents: 20000, note: "Bank transfer", idempotencyKey: "k2", paidOffPlatformAt: "2026-09-28" });
  });

  it("refuses a malformed day instead of sending it", () => {
    expect(() =>
      buildCreditGrantBody({ amountCents: 100, note: "", idempotencyKey: "k3", paidOffPlatformAt: "28/09/2026" }),
    ).toThrow();
  });

  it("today is YYYY-MM-DD in the local calendar", () => {
    expect(todayIsoDate(new Date(2026, 9, 11, 23, 30))).toBe("2026-10-11");
  });
});

describe("grantCredits sends the payment date on the wire", () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, newBalanceCents: "20000" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs /billing/credits/grant with paidOffPlatformAt when the client paid us", async () => {
    const { grantCredits } = await import("../src/lib/api");
    await grantCredits(20000, "Bank transfer", { paidOffPlatformAt: "2026-09-28", token: "t" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/billing/credits/grant");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ amountCents: 20000, note: "Bank transfer", paidOffPlatformAt: "2026-09-28" });
    expect(typeof body.idempotencyKey).toBe("string");
  });

  it("a gift POSTs no paidOffPlatformAt", async () => {
    const { grantCredits } = await import("../src/lib/api");
    await grantCredits(5000, "goodwill", { token: "t" });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect("paidOffPlatformAt" in body).toBe(false);
  });
});

describe("billing page grant form", () => {
  const page = fs.readFileSync(
    path.resolve(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"),
    "utf-8",
  );
  it("offers the paid-directly choice with a date and threads it into grantCredits", () => {
    expect(page).toContain("The client paid us directly");
    expect(page).toContain('type="date"');
    expect(page).toContain("paidOffPlatformAt: grantIsPayment ? grantPaidOn : null");
  });
  it("never says agency", () => {
    expect(page.toLowerCase()).not.toContain("agency");
  });
});
