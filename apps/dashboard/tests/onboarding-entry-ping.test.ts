import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createRateLimiter,
  entryMessage,
  isBotUserAgent,
  isOnboardingEntry,
  websiteHost,
} from "../src/lib/onboarding-entry-ping";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("onboarding entry ping (owner 2026-10-01: a Telegram per onboarding entry)", () => {
  it("counts a plain arrival and a landing hand-over as an entry", () => {
    expect(isOnboardingEntry("")).toBe(true);
    expect(isOnboardingEntry("?url=acme.com")).toBe(true);
  });

  it("does not count adding a brand, a claim return, a Google resume, a brand resume or a Stripe return", () => {
    for (const q of ["?from=add", "?claimed=1", "?resume=1", "?brandId=b1", "?checkout=success", "?session_id=cs_1"]) {
      expect(isOnboardingEntry(q)).toBe(false);
    }
  });

  it("treats crawlers and a missing UA as machines, a real browser as a person", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605")).toBe(false);
  });

  it("reduces a typed website to its host", () => {
    expect(websiteHost("https://www.acme.com/pricing")).toBe("acme.com");
    expect(websiteHost("acme.io")).toBe("acme.io");
    expect(websiteHost("")).toBeNull();
  });

  it("names the flow, the landing arm and every fact present", () => {
    const text = entryMessage({
      flow: "v2",
      variant: "subscription",
      website: "acme.com",
      channel: "cold_email",
      utmSource: "cold-email",
      referrer: null,
      country: "FR",
      signedIn: false,
    });
    expect(text).toContain("onboarding v2");
    expect(text).toContain("Landing arm: subscription");
    expect(text).toContain("Website: acme.com");
    expect(text).toContain("cold_email · utm cold-email");
    expect(text).toContain("Country: FR");
    expect(text).not.toContain("Signed in");
  });

  it("says when the visitor never saw the landing", () => {
    const text = entryMessage({
      flow: "v1",
      variant: null,
      website: null,
      channel: null,
      utmSource: null,
      referrer: null,
      country: null,
      signedIn: true,
    });
    expect(text).toContain("Landing arm: none");
    expect(text).toContain("Signed in");
  });

  it("caps pings per IP", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 1)).toBe(true);
    expect(allow("ip", 2)).toBe(false);
    expect(allow("other", 2)).toBe(true);
    expect(allow("ip", 1500)).toBe(true);
  });

  it("is mounted on BOTH onboarding first pages, with their flow", () => {
    expect(read("src/app/(authed)/get-started/page.tsx")).toContain('<OnboardingEntryPing flow="v2" />');
    expect(read("src/app/(authed)/onboarding/page.tsx")).toContain('<OnboardingEntryPing flow="v1" />');
  });

  it("the route sits under the public prefix and sends to the owner chat", () => {
    const route = read("src/app/api/public/onboarding-entry/route.ts");
    expect(route).toContain("TELEGRAM_OWNER_CHAT_ID");
    expect(route).toContain("api.telegram.org");
    expect(read("src/proxy.ts")).toContain('"/api/public(.*)"');
  });
});
