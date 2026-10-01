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
  it("keeps non-exception events", () => {
    expect(beforeSend(pageview)).toBe(pageview);
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
