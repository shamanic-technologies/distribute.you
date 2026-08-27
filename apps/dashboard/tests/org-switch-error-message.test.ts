import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  orgSwitchErrorMessage,
  OFFLINE_MESSAGE,
  AUTH_UNREACHABLE_MESSAGE,
  GENERIC_MESSAGE,
} from "../src/lib/org-switch-error";

/**
 * An org switch that fails names the party that actually failed.
 *
 * `withTimeout` turned an unbounded hang into a loud failure, and the sentence
 * it carried blamed "the auth service" for every timeout. The case it fires on
 * most is a browser with no network: the report that opened this had EVERY
 * request on the page failing `net::ERR_INTERNET_DISCONNECTED`, PostHog's own
 * CDN included, so nothing about the auth service was in question.
 *
 * `org-switch-error.ts` is alias-free, so these are real unit tests.
 */
describe("orgSwitchErrorMessage", () => {
  const timeout = () => {
    const err = new Error("Switching organization timed out after 15s.");
    err.name = "TimeoutError";
    return err;
  };

  it("names the network, not the auth service, when the browser is offline", () => {
    const msg = orgSwitchErrorMessage(timeout(), false);
    expect(msg).toBe(OFFLINE_MESSAGE);
    expect(msg).not.toMatch(/auth service/i);
  });

  it("keeps the auth-service reading when the browser believes it is online", () => {
    // `navigator.onLine === true` proves only that an interface exists, so a
    // timeout here really is "we could not reach it", cause unknown.
    expect(orgSwitchErrorMessage(timeout(), true)).toBe(AUTH_UNREACHABLE_MESSAGE);
  });

  it("passes a refusal through verbatim - it states its own reason", () => {
    const refusal = new Error("Could not open that organization (join failed: 403).");
    expect(orgSwitchErrorMessage(refusal, true)).toBe(refusal.message);
    expect(orgSwitchErrorMessage(refusal, false)).toBe(refusal.message);
  });

  it("falls back to one generic line for a non-Error throw", () => {
    expect(orgSwitchErrorMessage("nope", true)).toBe(GENERIC_MESSAGE);
    expect(orgSwitchErrorMessage(new Error("   "), true)).toBe(GENERIC_MESSAGE);
  });

  it("carries no em-dash in any user-facing string", () => {
    for (const msg of [OFFLINE_MESSAGE, AUTH_UNREACHABLE_MESSAGE, GENERIC_MESSAGE]) {
      expect(msg).not.toContain("—");
    }
  });
});

describe("the switcher reads the shared helper rather than inlining the copy", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "src/lib/use-tenant-switcher.ts"),
    "utf-8",
  );

  it("calls orgSwitchErrorMessage", () => {
    expect(src).toContain("orgSwitchErrorMessage(");
  });

  it("no longer inlines the auth-service sentence", () => {
    // A second copy of the copy is how the two would drift into saying
    // different things about one failure.
    expect(src).not.toContain('"Couldn\'t reach the auth service');
  });

  it("reads navigator.onLine only as a decisive FALSE", () => {
    // `!== false` and never `=== true`: an online flag proves nothing, so it
    // must not be allowed to claim the network is fine.
    expect(src).toContain("navigator.onLine !== false");
  });
});
