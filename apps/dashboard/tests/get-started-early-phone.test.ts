import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGetStartedSnapshot, parseSnapshotPhone } from "../src/lib/v2/get-started";

/**
 * Owner 2026-10-15: the WhatsApp number is asked on the FIRST page, under the website,
 * optional. It lets us pick the walk up on WhatsApp and greet them there at once (a
 * campaign on the "WhatsApp number given" trigger, fed by the PostHog connector).
 */
const gs = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
const hero = gs.slice(gs.indexOf("function Hero({"), gs.indexOf("function OrgBar("));
const start = gs.slice(gs.indexOf("async function start(raw: string)"), gs.indexOf("async function startWithoutWebsite("));

describe("the first page asks the WhatsApp number, optional", () => {
  it("renders the field under the website, labelled optional, without stealing the website's focus", () => {
    expect(hero).toContain("{phone && (");
    expect(hero).toContain("Your WhatsApp");
    expect(hero).toContain("(optional)");
    expect(hero).toContain("autoFocus={false}");
    expect(hero.indexOf('aria-label="Your website"')).toBeLessThan(hero.indexOf("<PhoneField"));
  });

  it("the dashboard walk shows no phone field", () => {
    expect(gs).toContain("phone={org ? null : phone}");
  });

  it("an empty number passes, a typed one must be a number, checked before anything starts", () => {
    expect(start).toContain("phoneSyntaxProblem(phone)");
    expect(start.indexOf("phoneSyntaxProblem(phone)")).toBeLessThan(start.indexOf("ran.current = true"));
    expect(start).not.toContain("requiredPhoneProblem");
  });

  it("a given number goes on the PostHog person (E.164) and rides the snapshot to the wall", () => {
    expect(start).toContain("posthog.setPersonProperties({ phone: toE164(given) })");
    expect(gs).toContain("phone: givenPhoneRef.current,");
    expect(gs).toContain("earlyPhone={givenPhone}");
  });
});

describe("the snapshot keeps the number across the Google round trip", () => {
  const base = { version: 2, website: "https://home.cern", brandId: "b1", brandName: null, domain: null, overview: "", facts: [], competitors: [], offer: null, audience: null, email: null };
  it("reads a stored number back", () => {
    const phone = { countryCode: "FR", dialCode: "33", national: "6 12 34 56 78" };
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, phone }))?.phone).toEqual(phone);
  });
  it("an absent, empty or malformed number is null", () => {
    expect(parseGetStartedSnapshot(JSON.stringify(base))?.phone).toBeNull();
    expect(parseSnapshotPhone({ countryCode: "FR", dialCode: "33", national: "  " })).toBeNull();
    expect(parseSnapshotPhone({ countryCode: "FR", national: "612" })).toBeNull();
    expect(parseSnapshotPhone("0612")).toBeNull();
  });
});
