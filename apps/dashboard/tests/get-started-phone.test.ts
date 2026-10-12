import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requiredPhoneProblem, phoneSyntaxProblem } from "../src/lib/phone-syntax";
import { defaultPhoneCountry } from "../src/components/v2/get-started/phone-field";

/**
 * Owner 2026-10-04: every `/get-started` signup leaves a phone number. The wall asks
 * for it right after the account exists and BEFORE the card, so someone who stops at
 * the card still left one. Required: no way past it empty.
 */
const wall = readFileSync(join(__dirname, "../src/components/v2/get-started/account-card-wall.tsx"), "utf8");

describe("requiredPhoneProblem", () => {
  it("refuses an empty number (the step is required)", () => {
    expect(requiredPhoneProblem({ dialCode: "33", national: "" })).toBe("Enter your phone number.");
    expect(requiredPhoneProblem({ dialCode: "33", national: "   " })).toBe("Enter your phone number.");
  });

  it("applies the same syntax rule as the route once something is typed", () => {
    expect(requiredPhoneProblem({ dialCode: "33", national: "6 12 34 56 78" })).toBeNull();
    expect(requiredPhoneProblem({ dialCode: "1", national: "123" })).toBe(phoneSyntaxProblem({ dialCode: "1", national: "123" }));
  });
});

describe("defaultPhoneCountry (owner 2026-10-13: the country the visitor connects from)", () => {
  it("opens on the connection's country first, whatever the browser language says", () => {
    expect(defaultPhoneCountry("FR", "en-US").code).toBe("FR");
    expect(defaultPhoneCountry("fr", "fr").code).toBe("FR");
  });
  it("reads the region off the browser language when the connection names none we list", () => {
    expect(defaultPhoneCountry(null, "fr-FR").code).toBe("FR");
    expect(defaultPhoneCountry("XX", "en_GB").code).toBe("GB");
    expect(defaultPhoneCountry("T1", "de-DE").code).toBe("DE");
  });
  it("falls back to the default country when neither names one", () => {
    expect(defaultPhoneCountry(null, "fr").code).toBe("US");
    expect(defaultPhoneCountry(undefined, undefined).code).toBe("US");
  });
  it("the public page reads Cloudflare's country on the server and hands it to the wall", () => {
    const page = readFileSync(join(__dirname, "../src/app/(authed)/get-started/page.tsx"), "utf8");
    expect(page).toContain('get("cf-ipcountry")');
    expect(page).toContain("<GetStarted ipCountry={ipCountry} />");
    const gs = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
    expect(gs).toContain("<AccountCardWall\n          ipCountry={ipCountry}");
    expect(wall).toContain("defaultPhoneCountry(ipCountry, navigator.language)");
  });
});

describe("the wall asks for the phone between the account and the card", () => {
  it("the claim lands on the phone stage, not the card", () => {
    const claim = wall.slice(wall.indexOf('fetch("/api/anon/claim"'), wall.indexOf("// ── Phone ──"));
    expect(claim).toContain('setStage("phone")');
    expect(claim).not.toContain('setStage("card")');
  });

  it("the phone stage saves through the route, then opens the card", () => {
    const submit = wall.slice(wall.indexOf("async function submitPhone("), wall.indexOf("// ── Credit ──"));
    expect(submit.indexOf("requiredPhoneProblem(phone)")).toBeGreaterThan(-1);
    expect(submit.indexOf("requiredPhoneProblem(phone)")).toBeLessThan(submit.indexOf("await savePhoneNumber(phone)"));
    expect(submit.indexOf("await savePhoneNumber(phone)")).toBeLessThan(submit.indexOf('setStage("card")'));
  });

  it("renders the phone form on its stage", () => {
    expect(wall).toContain('{stage === "phone" && (');
    expect(wall).toContain("<PhoneField");
  });
});
