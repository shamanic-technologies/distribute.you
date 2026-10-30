import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_X_ACCOUNT_TYPE,
  X_ACCOUNT_TYPES,
  X_CALLBACK_PATH,
  X_PROD_REDIRECT_URI,
  parseXTrip,
  xCallbackUrl,
  xFinishErrorMessage,
  xReturnUrl,
  xStartErrorMessage,
} from "../src/lib/x-connect";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("X connect round trip (X-ACCOUNTS-1030)", () => {
  it("has ONE fixed callback, with no org or brand in it, served by a page", () => {
    expect(X_CALLBACK_PATH).not.toMatch(/orgs|brands/);
    expect(xCallbackUrl("https://dashboard.distribute.you")).toBe(X_PROD_REDIRECT_URI);
    expect(read("src/app/(authed)/connections/x/callback/page.tsx")).toContain("xReturnUrl(");
  });

  it("offers the three types, Pro (AI) first and by default", () => {
    expect(X_ACCOUNT_TYPES.map((t) => t.label)).toEqual(["Pro (AI)", "Pro (human)", "Personal (human)"]);
    expect(DEFAULT_X_ACCOUNT_TYPE).toBe("pro_ai");
  });

  it("only trusts a stored trip that points back to a path on this site", () => {
    expect(parseXTrip(JSON.stringify({ orgId: "o1", returnTo: "/v2/orgs/o1/brands/b1/account" }))).toEqual({
      orgId: "o1",
      returnTo: "/v2/orgs/o1/brands/b1/account",
    });
    expect(parseXTrip(JSON.stringify({ orgId: "o1", returnTo: "https://evil.example" }))).toBeNull();
    expect(parseXTrip(JSON.stringify({ orgId: "o1", returnTo: "//evil.example" }))).toBeNull();
    expect(parseXTrip(null)).toBeNull();
    expect(parseXTrip("not json")).toBeNull();
  });

  it("hands code + state back to the Account page, or the reason", () => {
    expect(xReturnUrl("/v2/orgs/o1/brands/b1/account", { code: "c", state: "s" })).toBe(
      "/v2/orgs/o1/brands/b1/account?xCode=c&xState=s",
    );
    expect(xReturnUrl("/x?xCode=old", { error: "You cancelled the X login." })).toBe(
      "/x?xError=You+cancelled+the+X+login.",
    );
  });

  it("says the connection is being set up while our X app has no X keys", () => {
    const missingKey = { status: 502, body: { error: "key-service has no platform key", details: { provider: "X_OAUTH_APP_DISTRIBUTE_CLIENT_ID" } } };
    expect(xStartErrorMessage(missingKey)).toBe("X connection is being set up, try again soon.");
    expect(xStartErrorMessage({ status: 502, body: { error: "X refused" } })).toBe("We could not open X just now. Try again.");
    expect(xFinishErrorMessage({ status: 400, body: { error: "expired" } })).toBe("This X login expired. Connect the account again.");
  });

  it("refuses a connect while the org's balance is empty, in our words", () => {
    expect(xFinishErrorMessage({ status: 402, body: { error: "insufficient_balance" } })).toBe("Add credit to your balance, then connect the account again.");
  });

  it("puts the card right after Threads on Integrations, never on the Profile page", () => {
    const card = read("src/components/settings/brand-integrations-card.tsx");
    expect(card).toContain('rows.push(<XAccountsCard key="x" bare />);');
    expect(card.indexOf("<ThreadsAccountsCard")).toBeLessThan(card.indexOf("<XAccountsCard"));
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/account/page.tsx")).not.toContain("XAccountsCard");
  });
});

