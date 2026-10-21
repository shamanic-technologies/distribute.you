import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { accountSalesRep, salesRepDefaultWrite } from "../src/lib/sales-rep-account";

const NONE = { salesRepEmail: null, salesRepPhone: null, salesRepFirstName: null, salesRepRole: null };

const account = {
  primaryEmailAddress: { emailAddress: "info@jarygo.com" },
  firstName: "Marie",
  publicMetadata: { phoneCountryCode: "FR", phoneDialCode: "+33", phoneNational: "7 70 65 75 85" },
};

describe("accountSalesRep", () => {
  it("takes the email, the signup phone in E.164 and the first name", () => {
    expect(accountSalesRep(account)).toEqual({
      salesRepEmail: "info@jarygo.com",
      salesRepPhone: "+33770657585",
      salesRepFirstName: "Marie",
    });
  });

  it("leaves out what the account never gave", () => {
    expect(accountSalesRep({ primaryEmailAddress: { emailAddress: "a@b.co" } })).toEqual({
      salesRepEmail: "a@b.co",
      salesRepPhone: null,
      salesRepFirstName: null,
    });
  });

  it("leaves out a number brand-service could not dial, so the email still lands", () => {
    const bad = { ...account, publicMetadata: { phoneCountryCode: "FR", phoneDialCode: "+33", phoneNational: "12" } };
    expect(accountSalesRep(bad).salesRepPhone).toBeNull();
  });
});

describe("salesRepDefaultWrite", () => {
  const facts = accountSalesRep(account);

  it("fills an empty rep with the whole account", () => {
    expect(salesRepDefaultWrite(NONE, facts)).toEqual({
      salesRepEmail: "info@jarygo.com",
      salesRepPhone: "+33770657585",
      salesRepFirstName: "Marie",
      salesRepRole: null,
    });
  });

  it("completes a rep that is already this account, only in its blanks", () => {
    const current = { ...NONE, salesRepEmail: "Info@Jarygo.com", salesRepRole: "Head of Partnerships" };
    expect(salesRepDefaultWrite(current, facts)).toEqual({
      salesRepEmail: "Info@Jarygo.com",
      salesRepPhone: "+33770657585",
      salesRepFirstName: "Marie",
      salesRepRole: "Head of Partnerships",
    });
  });

  it("never overwrites what this account's rep already states", () => {
    const current = { ...NONE, salesRepEmail: "info@jarygo.com", salesRepPhone: "+447700900123", salesRepFirstName: "Jo" };
    expect(salesRepDefaultWrite(current, facts)).toBeNull();
  });

  it("leaves somebody else alone", () => {
    expect(salesRepDefaultWrite({ ...NONE, salesRepEmail: "sales@other.com" }, facts)).toBeNull();
  });

  it("writes nothing without an account email", () => {
    expect(salesRepDefaultWrite(NONE, { ...facts, salesRepEmail: null })).toBeNull();
  });
});

describe("launch call sites", () => {
  it("both launches hand the whole user, not just the email", () => {
    const dir = join(__dirname, "../src/components/v2/get-started");
    expect(readFileSync(join(dir, "account-card-wall.tsx"), "utf8")).toContain(
      "await defaultSalesRepToAccount(brandId, userRef.current);",
    );
    expect(readFileSync(join(dir, "org-launch.tsx"), "utf8")).toContain(
      "await defaultSalesRepToAccount(brandId, user);",
    );
  });
});
