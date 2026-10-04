import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHANNEL_MARKS } from "../src/lib/acquisition-channels";
import { DEFAULT_CHANNEL_SLUG } from "../src/lib/start-catalogue";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

// The v1 `/start` picks and their shell are deleted (onboarding v2 only, owner
// 2026-10-04). What stays pinned here is the live data they read: the channel
// marks, the default channel and the catalogue route's founder count.

/** Every channel slug production publishes on 2026-09-18, read off
 *  `GET /public/channels` inside the features-service container. The marks are
 *  what every surface draws, so a slug published upstream without one is a
 *  blank tile somewhere. */
const PROD_SLUGS = [
  "sales-cold-email-outreach", "pr-cold-email-outreach", "pr-expert-quote-outreach",
  "sales-crm-email-outreach", "feedback-request-cold-email-outreach", "cold-call-outreach",
  "cold-sms-outreach", "cold-whatsapp-outreach", "cold-linkedin-outreach", "cold-x-outreach",
  "cold-instagram-outreach", "cold-reddit-outreach", "google-ads", "meta-ads", "linkedin-ads",
  "tiktok-ads", "youtube-ads", "x-ads", "reddit-ads", "bing-ads", "quora-ads",
  "newsletter-sponsorships", "podcast-sponsorships", "creator-sponsorships",
  "paid-directory-listings", "seo-content", "press-placements", "podcast-guesting",
  "affiliate-programme", "organic-linkedin-publishing", "organic-x-publishing",
  "organic-reddit-publishing", "organic-youtube-publishing", "ai-meeting-booking",
  "agency-meeting-booking", "your-team-meeting-booking", "agency-meeting-attendance",
  "your-team-meeting-attendance", "agency-closing-calls", "your-team-closing-calls",
  "agency-signup-conversion", "your-team-signup-conversion",
];

describe("the public catalogue data", () => {
  it("every published channel has a mark, so no option card is a blank tile", () => {
    const missing = PROD_SLUGS.filter((s) => !CHANNEL_MARKS[s]);
    expect(missing).toEqual([]);
  });

  it("the default channel is sales cold email", () => {
    expect(DEFAULT_CHANNEL_SLUG).toBe("sales-cold-email-outreach");
  });

  /**
   * This guard used to pin `readPublic("stats/users")` -- the call was SPELLED
   * correctly and pointed at a path the gateway 404s, so the count was null on
   * every request and the strip rendered its shipped seed. A spelling is not a
   * connection: pin the PREFIX, which is the half that was wrong.
   */
  it("reads the founder count off the gateway's unversioned public path", () => {
    const route = read("app/api/public/catalogue/route.ts");
    expect(route).toContain('readGatewayPublic("stats/users")');
    expect(route).not.toContain('readPublic("stats/users")');
    expect(route).toContain("founders");
  });
});
