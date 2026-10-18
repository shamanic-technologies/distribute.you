import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isClerkAutoOrgName, isFreeMailDomain, orgNameFor } from "../src/lib/org-name-rule";

describe("orgNameFor: never Personal", () => {
  it("names the org after the brand first", () => {
    expect(orgNameFor({ brandName: "Acme", email: "jane@acme.io", firstName: "Jane", lastName: "Doe" })).toBe("Acme");
  });

  it("falls back to a business email's domain", () => {
    expect(orgNameFor({ brandName: null, email: "jane@acme.io", firstName: "Jane", lastName: "Doe" })).toBe("acme.io");
    expect(orgNameFor({ brandName: "  ", email: "cexo@cexoai.com" })).toBe("cexoai.com");
  });

  it("skips free-mail domains for the full name", () => {
    expect(orgNameFor({ email: "jane@gmail.com", firstName: "Jane", lastName: "Doe" })).toBe("Jane Doe");
    expect(orgNameFor({ email: "jane@hotmail.it", firstName: "Jane" })).toBe("Jane");
    expect(orgNameFor({ email: "jane@proton.me", lastName: "Doe" })).toBe("Doe");
  });

  it("uses the email's local part when there is no full name either", () => {
    expect(orgNameFor({ email: "jane.doe@gmail.com" })).toBe("jane.doe");
  });

  it("returns null when nothing is known, so the org is left alone", () => {
    expect(orgNameFor({})).toBeNull();
  });

  it("never returns Personal", () => {
    for (const input of [{}, { email: "a@gmail.com" }, { email: "x@acme.io" }, { firstName: "A" }]) {
      expect(orgNameFor(input)).not.toBe("Personal");
    }
  });
});

describe("isFreeMailDomain", () => {
  it.each(["gmail.com", "GMAIL.COM", "googlemail.com", "outlook.fr", "hotmail.co.uk", "yahoo.es", "icloud.com", "proton.me", "protonmail.com", "orange.fr"])(
    "%s is free mail",
    (d) => expect(isFreeMailDomain(d)).toBe(true),
  );
  it.each(["acme.io", "cexoai.com", "mail.acme.io", "gmailer.com"])("%s is a business", (d) =>
    expect(isFreeMailDomain(d)).toBe(false),
  );
});

describe("isClerkAutoOrgName: a name the person chose is never overwritten", () => {
  it("Clerk's fallback and the full name are auto", () => {
    expect(isClerkAutoOrgName("Personal", null, null)).toBe(true);
    expect(isClerkAutoOrgName("Jane Doe", "Jane", "Doe")).toBe(true);
  });
  it("anything else is the person's", () => {
    expect(isClerkAutoOrgName("CeXO AI", "Jane", "Doe")).toBe(false);
    expect(isClerkAutoOrgName("Acme", null, null)).toBe(false);
  });
});

describe("the claim route names the org", () => {
  const SRC = fs.readFileSync(path.join(__dirname, "../src/app/api/anon/claim/route.ts"), "utf8");

  it("renames only over Clerk's auto name", () => {
    const at = SRC.indexOf("async function nameClerkOrg(");
    const body = SRC.slice(at, SRC.indexOf("const isSecure", at));
    expect(body).toContain("isClerkAutoOrgName(org.name");
    expect(body.indexOf("isClerkAutoOrgName(org.name")).toBeLessThan(body.indexOf("updateOrganization("));
    expect(body).toContain("rememberOrgName(orgId, wanted)");
  });

  it("tells client-service the same name and reads the brand before the claim", () => {
    expect(SRC).toContain("...(orgName ? { orgName } : {})");
    expect(SRC.indexOf("anonBrandName(secret")).toBeLessThan(SRC.indexOf("await claimAnonymousOrg("));
  });
});
