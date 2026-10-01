import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GOOGLE_CALLBACK_PATH, googleCallbackUrl, parseGoogleReturn, returnWithOutcome } from "../src/lib/google-connect";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("Gmail connect round trip", () => {
  it("returns to the callback Google has registered", () => {
    expect(GOOGLE_CALLBACK_PATH).toBe("/services/crm/oauth/callback");
    expect(googleCallbackUrl("https://dashboard.distribute.you")).toBe("https://dashboard.distribute.you/services/crm/oauth/callback");
  });

  it("the callback page lives at that exact path", () => {
    expect(read("app/(authed)/services/crm/oauth/callback/page.tsx")).toContain("finishGoogleConnect(code, state)");
  });

  it("reads back only a same-site return path", () => {
    expect(parseGoogleReturn(JSON.stringify({ orgId: "o", returnTo: "/v2/orgs/o/brands/b/settings" }))).toEqual({ orgId: "o", returnTo: "/v2/orgs/o/brands/b/settings" });
    expect(parseGoogleReturn(JSON.stringify({ orgId: "o", returnTo: "https://evil.example" }))).toBeNull();
    expect(parseGoogleReturn(JSON.stringify({ orgId: "o", returnTo: "//evil.example" }))).toBeNull();
    expect(parseGoogleReturn(JSON.stringify({ returnTo: "/x" }))).toBeNull();
    expect(parseGoogleReturn("not json")).toBeNull();
    expect(parseGoogleReturn(null)).toBeNull();
  });

  it("states the outcome on the return path, keeping its hash", () => {
    expect(returnWithOutcome("/v2/x?tab=a#integrations", { connected: true })).toBe("/v2/x?tab=a&gmail=connected#integrations");
    expect(returnWithOutcome("/v2/x?gmail=connected#integrations", { error: "No" })).toBe("/v2/x?gmailError=No#integrations");
  });

  it("finishes for the org the trip was started for, and runs once", () => {
    const page = read("app/(authed)/services/crm/oauth/callback/page.tsx");
    expect(page).toContain("setApiActiveOrgOverride(trip.orgId)");
    expect(page).toContain("if (ran.current) return;");
  });

  it("the Integrations card offers Gmail with Google's sign-in, no key to paste", () => {
    const card = read("components/settings/brand-integrations-card.tsx");
    expect(card).toContain('rows.unshift(<GmailRow key="gmail" orgId={orgId} />);');
    expect(card).toContain("startGoogleConnect(googleCallbackUrl(window.location.origin))");
    expect(card).toContain("window.sessionStorage.setItem(GOOGLE_RETURN_KEY");
    expect(card).toContain("disconnectGoogleAccount(email)");
  });
});
