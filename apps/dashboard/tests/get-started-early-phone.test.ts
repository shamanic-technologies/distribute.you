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

describe("the first page asks the first and last name, optional (owner 2026-10-15)", () => {
  it("renders both fields above the WhatsApp number, labelled optional", () => {
    expect(hero).toContain("{person && (");
    expect(hero).toContain("Your name");
    expect(hero.indexOf('aria-label="First name"')).toBeLessThan(hero.indexOf('aria-label="Last name"'));
    expect(hero.indexOf('aria-label="Last name"')).toBeLessThan(hero.indexOf("<PhoneField"));
    expect(gs).toContain("person={org ? null : { firstName, lastName }}");
  });

  it("a given name goes on the same PostHog person and rides the snapshot to the wall", () => {
    expect(start).toContain("first_name: person.firstName");
    expect(start).toContain("last_name: person.lastName");
    expect(gs).toContain("person: givenPersonRef.current,");
    expect(gs).toContain("earlyName={givenPerson}");
  });

  it("the wall sets it on the account after the claim, never over a name the account holds, never blocking", () => {
    const wallSrc = readFileSync(join(__dirname, "../src/components/v2/get-started/account-card-wall.tsx"), "utf8");
    const claim = wallSrc.slice(wallSrc.indexOf('fetch("/api/anon/claim"'), wallSrc.indexOf("// ── Name ──"));
    expect(claim.indexOf("await saveEarlyName()")).toBeLessThan(claim.indexOf("await openPhoneStage()"));
    const save = wallSrc.slice(wallSrc.indexOf("async function saveEarlyName("), wallSrc.indexOf("// ── Phone ──"));
    expect(save).toContain("!user.firstName");
    expect(save).toContain("!user.lastName");
    expect(save).toContain("await user.update(patch)");
    expect(save).toContain("console.error(");
  });

  it("the snapshot keeps the name; an empty one is null", () => {
    const base = { version: 2, website: "https://home.cern", brandId: "b1", brandName: null, domain: null, overview: "", facts: [], competitors: [], offer: null, audience: null, email: null };
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, person: { firstName: " Marie ", lastName: "" } }))?.person).toEqual({ firstName: "Marie", lastName: "" });
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, person: { firstName: " ", lastName: "" } }))?.person).toBeNull();
    expect(parseGetStartedSnapshot(JSON.stringify(base))?.person).toBeNull();
  });
});

describe("what they already gave comes back filled in (owner 2026-10-15)", () => {
  it("an earlier walk in this browser: name and number remembered at Start, read after mount", () => {
    expect(start).toContain("localStorage.setItem(GET_STARTED_YOU_KEY");
    expect(gs).toContain("parseRememberedYou(localStorage.getItem(GET_STARTED_YOU_KEY))");
    // Never over what they are typing now.
    expect(gs).toContain("setFirstName((cur) => cur || p.firstName)");
    expect(gs).toContain("setPhone((cur) => (cur.national.trim() ? cur : ph))");
  });

  it("parses what was remembered; nothing usable is null", async () => {
    const { parseRememberedYou } = await import("../src/lib/v2/get-started");
    const phone = { countryCode: "FR", dialCode: "33", national: "612345678" };
    expect(parseRememberedYou(JSON.stringify({ person: { firstName: "Marie", lastName: "Curie" }, phone }))).toEqual({ person: { firstName: "Marie", lastName: "Curie" }, phone });
    expect(parseRememberedYou(JSON.stringify({ person: null, phone }))?.phone).toEqual(phone);
    expect(parseRememberedYou(JSON.stringify({ person: null, phone: null }))).toBeNull();
    expect(parseRememberedYou("{nope")).toBeNull();
    expect(parseRememberedYou(null)).toBeNull();
  });

  it("an existing account: the phone stage opens with the number it already holds", async () => {
    const { accountPhone } = await import("../src/lib/v2/get-started");
    expect(accountPhone({ phone: "+33612345678", phoneCountryCode: "FR", phoneDialCode: "33", phoneNational: "6 12 34 56 78" })).toEqual({ countryCode: "FR", dialCode: "33", national: "6 12 34 56 78" });
    expect(accountPhone({})).toBeNull();
    expect(accountPhone({ phoneCountryCode: "FR", phoneDialCode: "33", phoneNational: "" })).toBeNull();
    const wallSrc = readFileSync(join(__dirname, "../src/components/v2/get-started/account-card-wall.tsx"), "utf8");
    const open = wallSrc.slice(wallSrc.indexOf("async function openPhoneStage("), wallSrc.indexOf("async function submitPhone("));
    expect(open.indexOf("accountPhone(userRef.current?.publicMetadata")).toBeLessThan(open.indexOf('setStage("phone")'));
  });
});
