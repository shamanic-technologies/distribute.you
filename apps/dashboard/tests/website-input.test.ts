import { describe, expect, it } from "vitest";

import {
  EMAIL_IN_WEBSITE_FIELD,
  NOT_A_WEBSITE,
  websiteInputProblem,
} from "../src/lib/website-input";

/**
 * Real unit tests, not source-substring guards: `website-input.ts` is
 * deliberately alias-free so it can be imported here. Keep it that way.
 */
describe("websiteInputProblem", () => {
  it("refuses an email address, which is the case that cost a customer", () => {
    // She typed her address on the landing, signed up with Google, and the
    // field arrived holding it. `extractDomain` reduced it to gmail.com, so the
    // brand was created on Google's domain and every step after read Gmail.
    expect(websiteInputProblem("kevin@gmail.com")).toBe(EMAIL_IN_WEBSITE_FIELD);
  });

  it("refuses a BUSINESS email too, because it is still not a website", () => {
    // The domain here happens to be the right one, so this is the case that
    // reads as harmless. It is not: accepting it teaches the field that an
    // address is a website, and the signup-email prefill already covers the
    // person who wants acme.com from kevin@acme.com.
    expect(websiteInputProblem("kevin@acme.com")).toBe(EMAIL_IN_WEBSITE_FIELD);
  });

  it("refuses the URL spelling of an address, where the @ is userinfo", () => {
    // What the landing carry stored: `normalizeLandingUrl` turned the typed
    // address into this and it parsed cleanly.
    expect(websiteInputProblem("https://kevin@gmail.com/")).toBe(EMAIL_IN_WEBSITE_FIELD);
    expect(websiteInputProblem("https://kevin:pw@acme.com/")).toBe(EMAIL_IN_WEBSITE_FIELD);
  });

  it("refuses a mailbox provider typed on its own", () => {
    for (const input of ["gmail.com", "https://gmail.com", "yahoo.co.uk", "proton.me"]) {
      expect(websiteInputProblem(input)).toBe(EMAIL_IN_WEBSITE_FIELD);
    }
  });

  it("accepts a website, with or without a scheme, with or without a path", () => {
    for (const input of [
      "acme.com",
      "https://acme.com",
      "http://acme.com",
      "acme.com/us/",
      "https://acme.com/us/?utm_source=x",
      "www.acme.com",
      "sub.acme.co.uk",
      "voozaa.app",
      "  acme.com  ",
    ]) {
      expect(websiteInputProblem(input)).toBeNull();
    }
  });

  it("refuses anything that is not a hostname", () => {
    for (const input of [
      "mon entreprise",
      "acme",
      "localhost",
      "192.168.1.1",
      "acme.123",
      "acme.",
      "-acme.com",
      "https://",
      "javascript:alert(1)",
    ]) {
      expect(websiteInputProblem(input)).toBe(NOT_A_WEBSITE);
    }
  });

  it("says nothing about an empty field, which the caller owns", () => {
    expect(websiteInputProblem("")).toBeNull();
    expect(websiteInputProblem("   ")).toBeNull();
    expect(websiteInputProblem(null)).toBeNull();
    expect(websiteInputProblem(undefined)).toBeNull();
  });

  it("names what we need instead, never a bare rejection", () => {
    // A refusal that only says "invalid" makes the person guess which part we
    // did not like, so both sentences carry the next move.
    expect(EMAIL_IN_WEBSITE_FIELD).toMatch(/website/i);
    expect(NOT_A_WEBSITE).toMatch(/acme\.com/);
    for (const message of [EMAIL_IN_WEBSITE_FIELD, NOT_A_WEBSITE]) {
      expect(message).not.toContain("—");
    }
  });
});
