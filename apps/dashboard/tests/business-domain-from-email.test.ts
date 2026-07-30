import { describe, it, expect } from "vitest";
import { businessDomainFromEmail } from "../src/lib/extract-domain";
import { isFreeEmailDomain } from "../src/lib/free-email-domains";

describe("businessDomainFromEmail", () => {
  it("extracts the domain from a business email", () => {
    expect(businessDomainFromEmail("kevin@acme.com")).toBe("acme.com");
  });

  it("lowercases the domain", () => {
    expect(businessDomainFromEmail("Kevin@ACME.COM")).toBe("acme.com");
  });

  it("keeps a subdomain and a multi-label public suffix", () => {
    expect(businessDomainFromEmail("kevin@sub.acme.co.uk")).toBe("sub.acme.co.uk");
  });

  it("trims surrounding whitespace", () => {
    expect(businessDomainFromEmail("  kevin@acme.com  ")).toBe("acme.com");
  });

  it("takes the LAST @ so a quoted local part cannot hijack the domain", () => {
    expect(businessDomainFromEmail('"kevin@personal"@acme.com')).toBe("acme.com");
  });

  // Free / personal providers: prefilling these would send the user to analyze
  // Gmail's own website, which is worse than leaving the field empty.
  it.each([
    "kevin@gmail.com",
    "kevin@googlemail.com",
    "kevin@icloud.com",
    "kevin@me.com",
    "kevin@proton.me",
    "kevin@protonmail.com",
    "kevin@aol.com",
    "kevin@gmx.de",
    "kevin@mail.com",
    "kevin@yandex.ru",
    "kevin@qq.com",
    "kevin@naver.com",
    "kevin@free.fr",
    "kevin@orange.fr",
    "kevin@comcast.net",
    "kevin@btinternet.com",
  ])("returns null for the free provider %s", (email) => {
    expect(businessDomainFromEmail(email)).toBeNull();
  });

  // Country variants of the big families are far too numerous to enumerate, so
  // they are matched on the leading label + a public-suffix-shaped remainder.
  it.each([
    "kevin@yahoo.com",
    "kevin@yahoo.fr",
    "kevin@yahoo.co.uk",
    "kevin@yahoo.com.br",
    "kevin@hotmail.com",
    "kevin@hotmail.co.uk",
    "kevin@hotmail.fr",
    "kevin@outlook.de",
    "kevin@live.com",
    "kevin@live.co.jp",
    "kevin@msn.com",
  ])("returns null for the family variant %s", (email) => {
    expect(businessDomainFromEmail(email)).toBeNull();
  });

  it("does not treat a family LABEL on a business domain as a free provider", () => {
    expect(businessDomainFromEmail("kevin@live.acme.com")).toBe("live.acme.com");
    expect(businessDomainFromEmail("kevin@outlook.acme.io")).toBe("outlook.acme.io");
  });

  it("returns null for disposable inboxes", () => {
    expect(businessDomainFromEmail("kevin@mailinator.com")).toBeNull();
    expect(businessDomainFromEmail("kevin@yopmail.com")).toBeNull();
  });

  it.each([undefined, null, "", "   ", "notanemail", "kevin@", "@acme.com", "kevin@acme"])(
    "returns null for the unusable input %p",
    (input) => {
      expect(businessDomainFromEmail(input as string | null | undefined)).toBeNull();
    },
  );

  it("returns null for an IP-literal domain (no letter TLD)", () => {
    expect(businessDomainFromEmail("kevin@[192.168.1.1]")).toBeNull();
    expect(businessDomainFromEmail("kevin@192.168.1.1")).toBeNull();
  });
});

describe("isFreeEmailDomain", () => {
  it("matches the exact set", () => {
    expect(isFreeEmailDomain("gmail.com")).toBe(true);
  });

  it("does not match a business domain", () => {
    expect(isFreeEmailDomain("acme.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isFreeEmailDomain("GMAIL.COM")).toBe(true);
  });
});
