import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_INSTAGRAM_ACCOUNT_TYPE,
  INSTAGRAM_ACCOUNT_TYPES,
  INSTAGRAM_CALLBACK_PATH,
  INSTAGRAM_PROD_REDIRECT_URI,
  cleanInstagramCode,
  instagramCallbackUrl,
  instagramDeniedMessage,
  instagramFinishErrorMessage,
  instagramReturnUrl,
  instagramStartErrorMessage,
  parseInstagramTrip,
} from "../src/lib/instagram-connect";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const callbackPage = () => read("src/app/(authed)/connections/instagram/callback/page.tsx");

describe("Instagram connect round trip (REELS-1124)", () => {
  it("has ONE fixed callback, the URL the owner registers in Meta's console", () => {
    expect(INSTAGRAM_CALLBACK_PATH).not.toMatch(/orgs|brands/);
    expect(INSTAGRAM_PROD_REDIRECT_URI).toBe("https://dashboard.distribute.you/connections/instagram/callback");
    expect(instagramCallbackUrl("https://dashboard.distribute.you")).toBe(INSTAGRAM_PROD_REDIRECT_URI);
  });

  it("offers the same three types as the other cards, Pro (AI) first and by default", () => {
    expect(INSTAGRAM_ACCOUNT_TYPES.map((t) => t.label)).toEqual(["Pro (AI)", "Pro (human)", "Personal (human)"]);
    expect(DEFAULT_INSTAGRAM_ACCOUNT_TYPE).toBe("pro_ai");
  });

  it("only trusts a stored trip that points back to a path on this site", () => {
    expect(parseInstagramTrip(JSON.stringify({ orgId: "o1", returnTo: "/v2/orgs/o1/brands/b1/integrations" }))).toEqual({
      orgId: "o1",
      returnTo: "/v2/orgs/o1/brands/b1/integrations",
    });
    expect(parseInstagramTrip(JSON.stringify({ orgId: "o1", returnTo: "https://evil.example" }))).toBeNull();
    expect(parseInstagramTrip(JSON.stringify({ orgId: "o1", returnTo: "//evil.example" }))).toBeNull();
    expect(parseInstagramTrip(null)).toBeNull();
    expect(parseInstagramTrip("not json")).toBeNull();
  });

  it("hands code + state back to the Accounts page, Instagram's #_ dropped", () => {
    expect(cleanInstagramCode("abc#_")).toBe("abc");
    expect(cleanInstagramCode("abc")).toBe("abc");
    expect(instagramReturnUrl("/v2/orgs/o1/brands/b1/integrations", { code: "c#_", state: "s" })).toBe(
      "/v2/orgs/o1/brands/b1/integrations?instagramCode=c&instagramState=s",
    );
  });

  it("goes back with a plain reason when the owner declines", () => {
    expect(instagramDeniedMessage("access_denied")).toBe("You cancelled the Instagram login.");
    expect(instagramDeniedMessage(null)).toBe("Instagram did not finish the login. Try again.");
    expect(instagramReturnUrl("/p?instagramCode=old", { error: "You cancelled the Instagram login." })).toBe(
      "/p?instagramError=You+cancelled+the+Instagram+login.",
    );
  });

  it("says Instagram is not set up yet on the named 502, never the producer's words", () => {
    const notConfigured = {
      status: 502,
      body: { type: "instagram_not_configured", error: "INSTAGRAM_OAUTH_CONNECT_APP missing", details: { provider: "INSTAGRAM_OAUTH_CONNECT_APP" } },
    };
    expect(instagramStartErrorMessage(notConfigured)).toBe("Instagram is not set up on our side yet. Try again soon.");
    expect(instagramFinishErrorMessage(notConfigured)).toBe("Instagram is not set up on our side yet. Try again soon.");
    expect(instagramStartErrorMessage({ status: 502, body: { type: "upstream", error: "boom" } })).toBe(
      "We could not open Instagram just now. Try again.",
    );
    expect(instagramFinishErrorMessage({ status: 400, body: { type: "instagram_login_invalid", error: "expired" } })).toBe(
      "This Instagram login expired. Connect the account again.",
    );
  });

  it("callback page relays through the helpers and ends on a sentence in every dead end", () => {
    const src = callbackPage();
    expect(src).toContain("instagramReturnUrl(trip.returnTo, { code, state })");
    expect(src).toContain("instagramReturnUrl(trip.returnTo, { error: instagramDeniedMessage(denied) })");
    // No trip in this browser: a declined login still says it was cancelled, never the waiting line.
    expect(src).toContain("instagramDeniedMessage(denied)} Go back to your Accounts page");
    expect(src).toContain("This Instagram login was not started here.");
  });

  it("sits after LinkedIn on Integrations > Accounts and AI, never on the Profile page", () => {
    const card = read("src/components/settings/brand-integrations-card.tsx");
    expect(card).toContain('rows.push(<InstagramAccountsCard key="instagram" bare />);');
    expect(card.indexOf("<LinkedinAccountsCard")).toBeLessThan(card.indexOf("<InstagramAccountsCard"));
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/account/page.tsx")).not.toContain("InstagramAccountsCard");
  });

  it("calls the gateway's served Instagram operations", () => {
    const api = read("src/lib/api.ts");
    for (const path of [
      "`/orgs/instagram/accounts?brandId=",
      "`/orgs/instagram/auth/start?brandId=",
      "`/orgs/instagram/auth/callback`",
      "`/orgs/instagram/accounts/${encodeURIComponent(accountId)}`",
    ]) {
      expect(api).toContain(path);
    }
  });
});
