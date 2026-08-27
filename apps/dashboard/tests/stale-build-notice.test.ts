import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  isStaleBuildError,
  isStaleBuildEvent,
  staleBuildReasonFrom,
} from "../src/lib/stale-build";

/**
 * A tab running a bundle the server has replaced says so.
 *
 * The box redeploys the dashboard within about five minutes of a merge, so a
 * tab left open across one keeps JS referencing Server Action ids, route
 * payloads and chunks that no longer exist. Every one of those arrives as an
 * UNHANDLED promise rejection, which no React error boundary sees, so the page
 * silently stops working. Observed in a real report:
 * `Server Action "00c30a9e..." was not found on the server`, twice, beside a
 * 404 on the route being opened, with nothing on screen.
 *
 * `stale-build.ts` is alias-free, so these are real unit tests.
 */
describe("isStaleBuildError", () => {
  it("recognises a Server Action the server no longer knows", () => {
    const err = new Error(
      'Server Action "00c30a9e662a7c44c0f7ee3352400f705d6d605a98" was not found on the server.',
    );
    err.name = "UnrecognizedActionError";
    expect(isStaleBuildError(err)).toBe(true);
  });

  it("recognises it from the class name alone", () => {
    const err = new Error("something opaque");
    err.name = "UnrecognizedActionError";
    expect(isStaleBuildError(err)).toBe(true);
  });

  it("recognises a chunk the deploy replaced", () => {
    const err = new Error("Loading chunk 4821 failed.");
    err.name = "ChunkLoadError";
    expect(isStaleBuildError(err)).toBe(true);
    expect(
      isStaleBuildError(new Error("Failed to fetch dynamically imported module: /_next/x.js")),
    ).toBe(true);
    expect(isStaleBuildError(new Error("Loading CSS chunk 12 failed."))).toBe(true);
  });

  it("does NOT fire on an ordinary failure", () => {
    // A broad match would tell people to reload on every error, which is a lie
    // that costs them whatever they had typed.
    expect(isStaleBuildError(new TypeError("x.map is not a function"))).toBe(false);
    expect(isStaleBuildError(new Error("Failed to fetch"))).toBe(false);
    expect(isStaleBuildError(new Error("API returned a non-JSON response"))).toBe(false);
    expect(isStaleBuildError(null)).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
    expect(isStaleBuildError({})).toBe(false);
    expect(isStaleBuildError("")).toBe(false);
  });
});

describe("staleBuildReasonFrom", () => {
  it("unwraps a promise rejection", () => {
    const err = new Error("boom");
    expect(staleBuildReasonFrom({ reason: err })).toBe(err);
  });

  it("unwraps a thrown error event", () => {
    const err = new Error("boom");
    expect(staleBuildReasonFrom({ error: err, message: "boom" })).toBe(err);
  });

  it("falls back to the event message when there is no error object", () => {
    expect(staleBuildReasonFrom({ message: "Loading chunk 3 failed." })).toBe(
      "Loading chunk 3 failed.",
    );
  });
});

describe("isStaleBuildEvent", () => {
  it("fires on the rejection shape a Server Action mismatch produces", () => {
    const err = new Error('Server Action "abc" was not found on the server.');
    err.name = "UnrecognizedActionError";
    expect(isStaleBuildEvent({ reason: err })).toBe(true);
  });

  it("fires on the throw shape a chunk failure produces", () => {
    const err = new Error("Loading chunk 9 failed.");
    err.name = "ChunkLoadError";
    expect(isStaleBuildEvent({ error: err, message: err.message })).toBe(true);
  });

  it("stays quiet on an unrelated rejection", () => {
    expect(isStaleBuildEvent({ reason: new Error("network request failed") })).toBe(false);
  });
});

describe("the notice is mounted, hard-reloads, and never reloads on its own", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  it("is mounted in the authed layout, so it covers onboarding too", () => {
    const layout = read("src/app/(authed)/layout.tsx");
    expect(layout).toContain("<StaleBuildNotice />");
    expect(layout).toContain('from "@/components/stale-build-notice"');
  });

  const notice = () => read("src/components/stale-build-notice.tsx");

  it("listens on BOTH the rejection and the throw", () => {
    // The two failures arrive on different events; listening to one only would
    // cover half of them.
    const src = notice();
    expect(src).toContain('window.addEventListener("unhandledrejection"');
    expect(src).toContain('window.addEventListener("error"');
    expect(src).toContain('window.removeEventListener("unhandledrejection"');
    expect(src).toContain('window.removeEventListener("error"');
  });

  it("reloads only from the button, never automatically", () => {
    // An error-triggered reload can loop, and it throws away whatever the
    // person had typed - the onboarding wizard, a draft, a chat thread.
    const src = notice();
    const at = src.indexOf("onClick={() => window.location.reload()}");
    expect(at, "the reload must hang off the button").toBeGreaterThan(-1);
    expect(src.split("window.location.reload()").length - 1).toBe(1);
  });

  it("keeps its tints inside the html.dark closed set", () => {
    const src = notice();
    const globals = read("src/app/globals.css");
    for (const cls of ["bg-blue-50", "border-blue-200", "text-blue-900"]) {
      expect(src).toContain(cls);
      expect(globals, `${cls} has no html.dark remap`).toContain(`html.dark .${cls}`);
    }
  });

  it("clears the support FAB corner on mobile", () => {
    // The FAB is pinned `right-4 bottom-4` on every dashboard page, so a bar at
    // `bottom-6` runs straight under it on a phone.
    expect(notice()).toContain("bottom-24");
  });

  it("carries no em-dash in its copy", () => {
    expect(notice()).not.toContain("—");
  });
});
