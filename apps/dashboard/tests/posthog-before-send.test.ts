import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { dropVendorNoise } from "../src/lib/posthog-before-send";

// The landing's suite runs the full fixture set (and the inline snippet) against the twin;
// this one gates CI: the twins stay byte-equal, the dashboard wires the filter, and the
// predicate holds both ways here too.
const read = (p: string) => readFileSync(resolve(__dirname, "../../..", p), "utf8");

const exception = (...list: unknown[]) => ({ event: "$exception", properties: { $exception_list: list } });
const ourFrame = { platform: "web:javascript", filename: "https://dashboard.distribute.you/_next/static/chunks/0il7d65d305z..js", function: "sN", in_app: true, lineno: 1, colno: 149901 };

describe("dashboard PostHog before_send", () => {
  it("is byte-equal to the landing's", () => {
    expect(read("apps/dashboard/src/lib/posthog-before-send.ts")).toBe(read("apps/landing/src/lib/posthog-before-send.ts"));
  });

  it("is wired into posthog.init", () => {
    expect(read("apps/dashboard/src/instrumentation-client.ts")).toContain("before_send: dropVendorNoise,");
  });

  it.each([
    ["an opaque cross-origin Script error. (Stripe, Turnstile, gtag)", exception({ type: "Error", value: "Script error." })],
    ["a SyntaxError in an injected blob: script", exception({ type: "SyntaxError", value: "Unexpected token ?", stacktrace: { type: "raw", frames: [{ ...ourFrame, filename: "blob:https://dashboard.distribute.you/e12ff267" }] } })],
    ["a SyntaxError that names no file", exception({ type: "SyntaxError", value: "Unexpected token .", stacktrace: { type: "raw", frames: [] } })],
  ])("drops %s", (_, event) => {
    expect(dropVendorNoise(event)).toBeNull();
  });

  it.each([
    ["our TypeError", exception({ type: "TypeError", value: "Cannot read properties of undefined", stacktrace: { type: "raw", frames: [ourFrame] } })],
    ["our JSON.parse SyntaxError", exception({ type: "SyntaxError", value: "Unexpected end of JSON input", stacktrace: { type: "raw", frames: [ourFrame] } })],
    ["a stale Server Action", exception({ type: "UnrecognizedActionError", value: 'Server Action "00c3" was not found on the server.' })],
    ["a ChunkLoadError", exception({ type: "ChunkLoadError", value: "Failed to load chunk /_next/static/chunks/0htqbfqy_b6bk.js from module 802177", stacktrace: { type: "raw", frames: [ourFrame] } })],
    ["an event that also carries one of ours", exception({ type: "Error", value: "Script error." }, { type: "TypeError", value: "boom", stacktrace: { type: "raw", frames: [ourFrame] } })],
  ])("keeps %s", (_, event) => {
    expect(dropVendorNoise(event)).toBe(event);
  });
});
