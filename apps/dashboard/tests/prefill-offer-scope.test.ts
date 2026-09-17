import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "src");
const API = readFileSync(join(SRC, "lib", "api.ts"), "utf8");
const CARD = readFileSync(
  join(SRC, "components", "settings", "brand-sales-funnels-card.tsx"),
  "utf8",
);
const ONBOARDING = readFileSync(
  join(SRC, "components", "onboarding", "onboarding.tsx"),
  "utf8",
);

/** The body of one function, bounded by the NEXT declaration rather than a measured length. */
function sliceFrom(src: string, anchor: string, until: string): string {
  const at = src.lastIndexOf(anchor);
  expect(at, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
  const end = src.indexOf(until, at + anchor.length);
  expect(end, `bound not found after ${anchor}: ${until}`).toBeGreaterThan(at);
  return src.slice(at, end);
}

/**
 * Starting an acquisition channel prefills the campaign's inputs from the brand, and
 * those inputs are the OFFER's own words. brand-service refuses a brand-scoped
 * extraction for a brand selling several offers, so a prefill that names none is a 409
 * that surfaced as a 502 and the campaign was never created: 21 of 144 brands could not
 * start a channel from Offer Settings at all.
 *
 * Both halves are pinned, because either alone is the feature absent: a reader that can
 * carry the offer while the page never passes one changes nothing, and a page that
 * passes one to a reader that drops it changes nothing either.
 */
describe("the prefill names WHICH offer the channel is being started for", () => {
  it("the reader carries the offer in the BODY, which is where features-service reads it", () => {
    const fn = sliceFrom(
      API,
      "export async function prefillFeatureInputs(",
      "/** Extract flat string map",
    );
    expect(fn).toContain("offerId?: string | null");
    // The gateway forwards this route's body verbatim and whitelists only `format` on
    // the query string, so the offer has to travel in the body or it never arrives.
    expect(fn).toContain("method: \"POST\"");
    expect(fn).toContain("body: { brandIds");
    expect(fn).not.toContain("prefill?format=text&offer");
  });

  it("omits the key entirely when no offer is named, rather than sending null", () => {
    const fn = sliceFrom(
      API,
      "export async function prefillFeatureInputs(",
      "/** Extract flat string map",
    );
    // features-service reads an ABSENT key as today's brand-scoped behaviour; an
    // explicit null is a different statement and a brand selling one thing must stay
    // byte-identical.
    expect(fn).toContain("...(offerId ? { offerId } : {})");
    expect(fn).not.toContain("offerId: offerId ?? null");
  });

  it("the Start path passes the open offer", () => {
    const fn = sliceFrom(
      CARD,
      "async function buildFeatureInputs(",
      "/** Flip one channel's switch",
    );
    expect(fn).toContain("prefillFeatureInputs(featureSlug, [brandId], offerId)");
  });

  it("caches the prefill per (channel, offer), never per channel alone", () => {
    const fn = sliceFrom(
      CARD,
      "async function buildFeatureInputs(",
      "/** Flip one channel's switch",
    );
    // One channel's inputs are a DIFFERENT answer per offer, so a slug-keyed cache
    // serves the first offer's copy to the second.
    expect(fn).toContain("`${featureSlug}|${offerId}`");
    expect(fn).not.toContain("featureInputsRef.current[featureSlug]");
  });

  it("onboarding still names none, because a brand is born with one offer", () => {
    // The launch runs before a second proposition can exist, and brand-service's
    // unnamed path is exactly today's behaviour for a brand selling one thing.
    expect(ONBOARDING).toContain("prefillFeatureInputs(SALES_FEATURE_SLUG, [id])");
  });
});

/**
 * campaign-service refuses a campaign name the org already holds, and a funnel is
 * routinely sold through more than one channel. Named for the funnel alone, the second
 * channel of a funnel answers 409 and can never be started.
 */
describe("a started campaign is named for its channel as well as its funnel", () => {
  it("the create carries the channel in the name", () => {
    const call = sliceFrom(CARD, "await startFunnelChannelCampaign({", "});");
    expect(call).toContain("${move.channelName}");
    expect(call).toContain("${vars.def.name}");
  });
});
