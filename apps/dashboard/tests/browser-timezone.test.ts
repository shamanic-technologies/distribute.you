import { describe, it, expect, afterEach } from "vitest";
import { browserTimezone } from "../src/lib/browser-timezone";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

const realIntl = globalThis.Intl;
afterEach(() => {
  globalThis.Intl = realIntl;
});

/**
 * `pipeline-activity` is a per-day series and features-service REFUSES it without a
 * timezone (`400 timezone query parameter is required`). A caller that leaves it out
 * therefore 400s on EVERY poll, and the surface it feeds — the Outcome line's forward
 * projection — silently draws nothing, which reads as "there is nothing to project"
 * rather than as a broken request. Nothing goes red: the gateway forwards the query
 * verbatim, the reader declares the field optional, and `tsc` is happy.
 *
 * So the guards below pin the CALL SITES, not only the helper: a helper every surface
 * could reach is the bug entirely intact if one of them never calls it.
 */
describe("browserTimezone", () => {
  it("returns the browser's own zone", () => {
    globalThis.Intl = {
      DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "Europe/Paris" }) }),
    } as unknown as typeof Intl;
    expect(browserTimezone()).toBe("Europe/Paris");
  });

  // A stated zone the producer can bucket in beats a request it has to refuse, so an
  // empty answer falls back rather than sending nothing. This is a default for a value
  // the BROWSER declined to state, not a swallowed failure of ours.
  it("falls back to UTC when the runtime states no zone", () => {
    globalThis.Intl = {
      DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "" }) }),
    } as unknown as typeof Intl;
    expect(browserTimezone()).toBe("UTC");
  });

  it("falls back to UTC when the runtime throws", () => {
    globalThis.Intl = {
      DateTimeFormat: () => {
        throw new Error("no Intl");
      },
    } as unknown as typeof Intl;
    expect(browserTimezone()).toBe("UTC");
  });
});

describe("every pipeline-activity reader states a timezone", () => {
  const sites: Array<[string, string]> = [
    ["brand Overview", "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"],
    ["campaign Overview", "components/campaigns/campaign-overview-page.tsx"],
    ["funnel Overview", "components/funnels/funnel-overview-page.tsx"],
  ];

  for (const [name, path] of sites) {
    it(`${name} sends days + timezone`, () => {
      const body = src(path);
      // The call itself, not merely the import: a page holding a `timezone` const it
      // never passes is the defect this guard exists for.
      expect(body).toMatch(/PipelineActivity\([^)]*\{[^}]*days:\s*7[^}]*timezone[^}]*\}/s);
    });

    it(`${name} keys the query on the timezone`, () => {
      // Without it, a reader who crosses a zone keeps the previous zone's days from
      // cache — the same reason the two older Overviews already carry it in the key.
      const body = src(path);
      expect(body).toMatch(/PipelineActivity",[^\]]*timezone\s*\]/s);
    });

    it(`${name} reads the ONE timezone home`, () => {
      const body = src(path);
      expect(body).toContain('from "@/lib/browser-timezone"');
      // Two copies of the Intl read is how one surface comes to bucket a customer's
      // days in a different zone from the surface beside it.
      expect(body).not.toContain("resolvedOptions()");
    });
  }
});
