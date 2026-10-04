import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { COUNTRIES, DEFAULT_COUNTRY, codeToFlag, searchCountries } from "../src/components/onboarding/phone-countries";

/**
 * The phone capture that outlived the v1 post-payment steps: the server route,
 * its client helper and the pure country module the phone input reads. The v1
 * wizard's post-payment step wiring and its offer-lever module are deleted
 * (owner 2026-10-04: onboarding v2 only).
 */

const phoneRoutePath = path.join(__dirname, "../src/app/(authed)/api/onboarding/phone/route.ts");
const apiSrc = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

describe("phone server route", () => {
  it("exists", () => {
    expect(fs.existsSync(phoneRoutePath)).toBe(true);
  });
  const content = fs.existsSync(phoneRoutePath) ? fs.readFileSync(phoneRoutePath, "utf-8") : "";
  it("derives the user id server-side and writes Clerk publicMetadata", () => {
    expect(content).toContain("await auth()");
    expect(content).toContain("updateUserMetadata");
    expect(content).toContain("publicMetadata");
  });
  it("rejects unauthenticated callers and invalid payloads", () => {
    expect(content).toContain("401");
    expect(content).toContain("400");
  });
});

describe("savePhoneNumber client helper", () => {
  it("POSTs to the phone route and fails loud on non-2xx", () => {
    expect(apiSrc).toContain("export async function savePhoneNumber");
    expect(apiSrc).toContain('"/api/onboarding/phone"');
    expect(apiSrc).toContain("throw new Error(`Failed to save phone number");
  });
  it("adds perceivedLikelihood to SALES_PROFILE_FIELDS so the lever prefills", () => {
    expect(apiSrc).toContain('key: "perceivedLikelihood"');
  });
});

describe("phone-countries module", () => {
  it("derives a flag emoji from the ISO code", () => {
    expect(codeToFlag("US")).toBe("\u{1F1FA}\u{1F1F8}");
    expect(codeToFlag("FR")).toBe("\u{1F1EB}\u{1F1F7}");
    expect(codeToFlag("xx!")).toBe("");
  });
  it("has a non-empty list defaulting to US +1", () => {
    expect(COUNTRIES.length).toBeGreaterThan(50);
    expect(DEFAULT_COUNTRY.code).toBe("US");
    expect(DEFAULT_COUNTRY.dial).toBe("1");
  });
  it("lists countries alphabetically ascending by name", () => {
    const names = COUNTRIES.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en"));
    expect(names).toEqual(sorted);
    expect(COUNTRIES[0].name).toBe("Albania");
  });
  it("searches by name, code and dial", () => {
    expect(searchCountries("franc").some((c) => c.code === "FR")).toBe(true);
    expect(searchCountries("gb").some((c) => c.code === "GB")).toBe(true);
    expect(searchCountries("+49").some((c) => c.code === "DE")).toBe(true);
    expect(searchCountries("").length).toBe(COUNTRIES.length);
  });
});
