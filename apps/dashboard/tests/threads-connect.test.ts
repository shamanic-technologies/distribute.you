import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_THREADS_ACCOUNT_TYPE,
  THREADS_ACCOUNT_TYPES,
  THREADS_CALLBACK_PATH,
  THREADS_PROD_REDIRECT_URI,
  parseThreadsTrip,
  threadsCallbackUrl,
  threadsFinishErrorMessage,
  threadsReturnUrl,
  threadsStartErrorMessage,
} from "../src/lib/threads-connect";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("Threads connect round trip (THREADS-ACCOUNT-CARD-1028)", () => {
  it("has ONE fixed callback, with no org or brand in it, served by a page", () => {
    expect(THREADS_CALLBACK_PATH).not.toMatch(/orgs|brands/);
    expect(threadsCallbackUrl("https://dashboard.distribute.you")).toBe(THREADS_PROD_REDIRECT_URI);
    expect(read("src/app/(authed)/connections/threads/callback/page.tsx")).toContain("threadsReturnUrl(");
  });

  it("offers the three types, Pro (AI) first and by default", () => {
    expect(THREADS_ACCOUNT_TYPES.map((t) => t.label)).toEqual(["Pro (AI)", "Pro (human)", "Personal (human)"]);
    expect(DEFAULT_THREADS_ACCOUNT_TYPE).toBe("pro_ai");
  });

  it("only trusts a stored trip that points back to a path on this site", () => {
    expect(parseThreadsTrip(JSON.stringify({ orgId: "o1", returnTo: "/v2/orgs/o1/brands/b1/account" }))).toEqual({
      orgId: "o1",
      returnTo: "/v2/orgs/o1/brands/b1/account",
    });
    expect(parseThreadsTrip(JSON.stringify({ orgId: "o1", returnTo: "https://evil.example" }))).toBeNull();
    expect(parseThreadsTrip(JSON.stringify({ orgId: "o1", returnTo: "//evil.example" }))).toBeNull();
    expect(parseThreadsTrip(null)).toBeNull();
    expect(parseThreadsTrip("not json")).toBeNull();
  });

  it("hands code + state back to the Account page, or the reason", () => {
    expect(threadsReturnUrl("/v2/orgs/o1/brands/b1/account", { code: "c", state: "s" })).toBe(
      "/v2/orgs/o1/brands/b1/account?threadsCode=c&threadsState=s",
    );
    expect(threadsReturnUrl("/x?threadsCode=old", { error: "You cancelled the Threads login." })).toBe(
      "/x?threadsError=You+cancelled+the+Threads+login.",
    );
  });

  it("says the connection is being set up while our Meta app has no Threads keys", () => {
    const missingKey = { status: 502, body: { error: "key-service has no platform key", details: { provider: "threads-app-id" } } };
    expect(threadsStartErrorMessage(missingKey)).toBe("Threads connection is being set up, try again soon.");
    expect(threadsStartErrorMessage({ status: 502, body: { error: "Threads refused" } })).toBe("We could not open Threads just now. Try again.");
    expect(threadsFinishErrorMessage({ status: 400, body: { error: "expired" } })).toBe("This Threads login expired. Connect the account again.");
  });

  it("puts the card on the Account page, never under Integrations", () => {
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/account/page.tsx")).toContain("<ThreadsAccountsCard />");
  });
});
