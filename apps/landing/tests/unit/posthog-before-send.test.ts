import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BEFORE_SEND_JS, dropVendorNoise } from "@/lib/posthog-before-send";

// The exact event PostHog built from Partnero's blocked settings.js (2026-10-01).
const partnero = {
  event: "$exception",
  properties: {
    $exception_list: [
      {
        type: "UnhandledRejection",
        value: "Non-Error promise rejection captured with value: Error: loading script",
        mechanism: { handled: false, synthetic: true, type: "generic" },
      },
    ],
  },
};
const ours = {
  event: "$exception",
  properties: { $exception_list: [{ type: "TypeError", value: "Error: loading script failed in our code" }] },
};
// The four shapes from the Edge 122 link-scanner sessions (2026-09-30, 2026-10-01), as
// posthog-js builds them in the browser (raw frames, before PostHog resolves them).
const exception = (...list: unknown[]) => ({ event: "$exception", properties: { $exception_list: list } });
const scriptError = exception({ type: "Error", value: "Script error.", mechanism: { handled: false, synthetic: true } });
const blobSyntaxError = exception({
  type: "SyntaxError",
  value: "Unexpected token ?",
  stacktrace: {
    type: "raw",
    frames: [{ platform: "web:javascript", filename: "blob:https://distribute.you/aac9d50f-1956-47c3-8e2c-7280573ae81a", function: "?", in_app: true, lineno: 72, colno: 54 }],
  },
});
const filelessSyntaxError = exception({ type: "SyntaxError", value: "Unexpected token .", stacktrace: { type: "raw", frames: [] } });

// Ours, each one a near miss of a rule above: they must all be kept.
const ourFrame = { platform: "web:javascript", filename: "https://distribute.you/_next/static/chunks/0ablm0~atm_56.js", function: "n", in_app: true, lineno: 1, colno: 14632 };
const ourTypeError = exception({ type: "TypeError", value: "x.map is not a function", stacktrace: { type: "raw", frames: [ourFrame] } });
const ourJsonParse = exception({ type: "SyntaxError", value: "Unexpected token < in JSON at position 0", stacktrace: { type: "raw", frames: [ourFrame] } });
const ourInlineParse = exception({
  type: "SyntaxError",
  value: "Unexpected token ?",
  stacktrace: { type: "raw", frames: [{ ...ourFrame, filename: "https://distribute.you/" }] },
});
const scriptErrorWithFile = exception({ type: "Error", value: "Script error.", stacktrace: { type: "raw", frames: [ourFrame] } });
const blobThenOurs = exception(
  { type: "Error", value: "Script error." },
  { type: "TypeError", value: "x.map is not a function", stacktrace: { type: "raw", frames: [ourFrame] } },
);
const mixedBlobFrames = exception({
  type: "TypeError",
  value: "boom",
  stacktrace: { type: "raw", frames: [{ ...ourFrame, filename: "blob:https://distribute.you/x" }, ourFrame] },
});
const ourStringRejection = exception({ type: "UnhandledRejection", value: "Non-Error promise rejection captured with value: nope" });
const ourChunkLoad = exception({
  type: "ChunkLoadError",
  value: "Failed to load chunk /_next/static/chunks/15ffn.klp0~6y.js from module 656877",
  stacktrace: { type: "raw", frames: [{ ...ourFrame, filename: "https://distribute.you/_next/static/chunks/turbopack-0y6at67ivqv_z.js" }] },
});

const pageview = { event: "$pageview", properties: { $current_url: "https://distribute.you/" } };

// The static pages carry the predicate as inline JS; evaluate that string, not a copy.
const inline = new Function(`return (${BEFORE_SEND_JS})`)() as (e: unknown) => unknown;

describe.each([
  ["posthog-js init (Next pages)", dropVendorNoise as (e: unknown) => unknown],
  ["inline snippet (static pages)", inline],
])("%s before_send", (_, beforeSend) => {
  it("drops Partnero's blocked-script rejection", () => {
    expect(beforeSend(partnero)).toBeNull();
  });
  it("keeps every other exception, even one that mentions loading script", () => {
    expect(beforeSend(ours)).toBe(ours);
  });
  it.each([
    ["an opaque cross-origin Script error.", scriptError],
    ["a SyntaxError raised in an injected blob: script", blobSyntaxError],
    ["a SyntaxError that names no file", filelessSyntaxError],
  ])("drops %s", (_, event) => {
    expect(beforeSend(event)).toBeNull();
  });
  it.each([
    ["our TypeError", ourTypeError],
    ["our JSON.parse SyntaxError", ourJsonParse],
    ["a parse error in our inline script", ourInlineParse],
    ["a Script error. that names a file", scriptErrorWithFile],
    ["an event that also carries one of ours", blobThenOurs],
    ["a stack that only passes through a blob:", mixedBlobFrames],
    ["our own non-Error rejection", ourStringRejection],
    ["a ChunkLoadError (reported, and the page reloads)", ourChunkLoad],
  ])("keeps %s", (_, event) => {
    expect(beforeSend(event)).toBe(event);
  });
  it("keeps non-exception events", () => {
    expect(beforeSend(pageview)).toBe(pageview);
  });
});

describe("the Ahrefs tag is loaded with CORS, so its errors name a file", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
  it("static pages and Next pages", () => {
    expect(read("src/lib/static-html.ts")).toContain('data-key="6jqRRazbkHBZRDiWAmampA" crossorigin="anonymous" async');
    expect(read("src/app/layout.tsx")).toMatch(/analytics\.ahrefs\.com\/analytics\.js"\s+data-key="6jqRRazbkHBZRDiWAmampA"\s+crossOrigin="anonymous"/);
  });
  it("Partnero's loader stays without crossorigin: it serves no CORS header and would be blocked", () => {
    expect(read("src/lib/static-html.ts")).not.toMatch(/universal\.js[^<]*crossOrigin/);
  });
});

describe("both landing PostHog inits wire the filter", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
  it("instrumentation-client.ts", () => {
    expect(read("src/instrumentation-client.ts")).toContain("before_send: dropVendorNoise");
  });
  it("static-html.ts snippet", () => {
    expect(read("src/lib/static-html.ts")).toContain("before_send:${BEFORE_SEND_JS}");
  });
});
