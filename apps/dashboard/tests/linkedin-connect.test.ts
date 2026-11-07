import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_LINKEDIN_ACCOUNT_TYPE,
  LINKEDIN_CALLBACK_PATH,
  LINKEDIN_PROD_REDIRECT_URI,
  isLinkedinNotConfigured,
  linkedinCallbackUrl,
  linkedinFinishErrorMessage,
  linkedinDeniedMessage,
  linkedinReturnUrl,
  linkedinStartErrorMessage,
  looksLikeLinkedinPage,
  parseLinkedinTrip,
} from "../src/lib/linkedin-connect";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("LinkedIn connect round trip (LINKEDIN-ACCOUNTS-1106)", () => {
  it("has ONE fixed callback, the one registered on our LinkedIn app, served by a page", () => {
    expect(LINKEDIN_CALLBACK_PATH).not.toMatch(/orgs|brands/);
    expect(linkedinCallbackUrl("https://dashboard.distribute.you")).toBe(LINKEDIN_PROD_REDIRECT_URI);
    expect(LINKEDIN_PROD_REDIRECT_URI).toBe("https://dashboard.distribute.you/connections/linkedin/callback");
    expect(read("src/app/(authed)/connections/linkedin/callback/page.tsx")).toContain("linkedinReturnUrl(");
    expect(DEFAULT_LINKEDIN_ACCOUNT_TYPE).toBe("pro_ai");
  });

  it("only trusts a stored trip pointing back to a path on this site, and returns code + state", () => {
    expect(parseLinkedinTrip(JSON.stringify({ orgId: "o1", returnTo: "//evil.example" }))).toBeNull();
    expect(parseLinkedinTrip(JSON.stringify({ orgId: "o1", returnTo: "/v2/orgs/o1/brands/b1/integrations" }))).toEqual({ orgId: "o1", returnTo: "/v2/orgs/o1/brands/b1/integrations" });
    expect(linkedinReturnUrl("/a", { code: "c", state: "s" })).toBe("/a?linkedinCode=c&linkedinState=s");
  });

  it("asks a profile or company page link before leaving", () => {
    expect(looksLikeLinkedinPage("https://www.linkedin.com/in/kevin-lourd/")).toBe(true);
    expect(looksLikeLinkedinPage("linkedin.com/company/distribute-you")).toBe(true);
    expect(looksLikeLinkedinPage("https://x.com/kevin")).toBe(false);
    expect(looksLikeLinkedinPage("https://www.linkedin.com/feed/")).toBe(false);
  });

  it("says plainly when our LinkedIn app is not set up yet (social-service's named 502)", () => {
    const missing = { status: 502, body: { type: "linkedin_not_configured", error: "LINKEDIN_OAUTH_CONNECT_APP not set", details: { provider: "LINKEDIN_OAUTH_CONNECT_APP" } } };
    expect(isLinkedinNotConfigured(missing)).toBe(true);
    expect(linkedinStartErrorMessage(missing)).toBe("LinkedIn is not set up on our side yet. Try again soon.");
    expect(isLinkedinNotConfigured({ status: 502, body: { type: "upstream", error: "LinkedIn down" } })).toBe(false);
    expect(linkedinFinishErrorMessage({ status: 400, body: { type: "linkedin_login_invalid" } })).toBe("This LinkedIn login expired. Connect the account again.");
    // LINKEDIN-PAGES-1107: what LinkedIn refused, named by social-service, is shown as is.
    const named = "This LinkedIn login is not an admin of linkedin.com/company/acme. Log in with a super or content admin of the page.";
    expect(linkedinFinishErrorMessage({ status: 400, body: { type: "linkedin_login_invalid", error: named } })).toBe(named);
  });

  it("sits right after X on Integrations, with its history import shown on each row", () => {
    const card = read("src/components/settings/brand-integrations-card.tsx");
    expect(card.indexOf("<XAccountsCard")).toBeLessThan(card.indexOf("<LinkedinAccountsCard"));
    const linkedin = read("src/components/v2/linkedin-accounts-card.tsx");
    expect(linkedin).toContain("importLine(account)");
    expect(linkedin).toContain("Reconnect");
  });
});

describe("LinkedIn sent the browser back without a code (LINKEDIN-PAGES-1107)", () => {
  it("a cancel, a permission LinkedIn refuses our app (named), anything else", () => {
    expect(linkedinDeniedMessage("access_denied", null)).toBe("You cancelled the LinkedIn login.");
    expect(linkedinDeniedMessage("user_cancelled_login", null)).toBe("You cancelled the LinkedIn login.");
    expect(linkedinDeniedMessage("unauthorized_scope_error", "Scope &quot;w_organization_social&quot; is not authorized for your application")).toBe(
      'LinkedIn refused a permission our app asked (Scope "w_organization_social" is not authorized for your application). Our team has to enable it on LinkedIn: contact us.',
    );
    expect(linkedinDeniedMessage("server_error", null)).toBe("LinkedIn did not finish the login. Try again.");
  });
});
