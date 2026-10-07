import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LinkedinFeedResponseSchema,
  isLongPost,
  linkedinAge,
  textRuns,
  toLinkedinFeedPage,
  topReactionKinds,
} from "../src/lib/v2/linkedin-post-view";

// A real social-service answer (HubSpot test brand, 2026-10-07): a post, a plain repost, a
// quote, and a post whose comments could not be read.
const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures/linkedin-feed-hubspot.json"), "utf8"));

describe("LinkedIn feed reader", () => {
  it("parses the producer's real answer and keeps every post", () => {
    const page = toLinkedinFeedPage(LinkedinFeedResponseSchema.parse(fixture));
    expect(page.status).toBe("ready");
    expect(page.posts).toHaveLength(fixture.posts.length);
    expect(page.nextCursor).toBe(fixture.nextCursor);
  });

  it("draws a plain repost under its header, a quote with the original inside", () => {
    const page = toLinkedinFeedPage(LinkedinFeedResponseSchema.parse(fixture));
    const repost = page.posts[1];
    expect(repost.header).toBeTruthy();
    const quote = page.posts[2];
    expect(quote.header).toBeNull();
    expect(quote.original).not.toBeNull();
  });

  it("keeps reactions per type and says when comments could not be read", () => {
    const page = toLinkedinFeedPage(LinkedinFeedResponseSchema.parse(fixture));
    expect(page.posts[0].reactions?.total).toBeGreaterThan(0);
    expect(Object.keys(page.posts[0].reactions?.byKind ?? {}).length).toBeGreaterThan(0);
    expect(page.posts[3].commentsStatus).toBe("failed");
  });

  it("maps the no-page / no-profile and undecided states", () => {
    const base = { reason: "r", linkedinPage: null, sync: null, total: 0, posts: [], nextCursor: null };
    expect(toLinkedinFeedPage(LinkedinFeedResponseSchema.parse({ ...base, status: "no_linkedin_page" })).status).toBe("none");
    expect(toLinkedinFeedPage(LinkedinFeedResponseSchema.parse({ ...base, status: "no_linkedin_profile" })).status).toBe("none");
    expect(toLinkedinFeedPage(LinkedinFeedResponseSchema.parse({ ...base, status: "linkedin_page_unresolved" })).status).toBe("undecided");
  });

  it("links the person's profile on the person read", () => {
    const base = { status: "ready", reason: null, sync: null, total: 0, posts: [], nextCursor: null };
    const page = toLinkedinFeedPage(LinkedinFeedResponseSchema.parse({ ...base, linkedinProfile: { url: "https://www.linkedin.com/in/x" } }));
    expect(page.sourceUrl).toBe("https://www.linkedin.com/in/x");
  });
});

describe("LinkedIn's own way of printing a post", () => {
  it("ages like LinkedIn", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(linkedinAge("2026-10-07T11:59:30Z", now)).toBe("now");
    expect(linkedinAge("2026-10-07T07:00:00Z", now)).toBe("5h");
    expect(linkedinAge("2026-10-04T12:00:00Z", now)).toBe("3d");
    expect(linkedinAge("2026-09-23T12:00:00Z", now)).toBe("2w");
    expect(linkedinAge("2025-09-01T12:00:00Z", now)).toBe("1yr");
  });

  it("stacks the three most used reactions", () => {
    expect(topReactionKinds({ like: 111, love: 7, celebrate: 5, insightful: 3 })).toEqual(["like", "love", "celebrate"]);
  });

  it("cuts the text around mentions and links", () => {
    expect(textRuns("Hi Ann Lee, bye", [{ start: 3, length: 7, url: "u" }])).toEqual([
      { text: "Hi ", url: null, linked: false },
      { text: "Ann Lee", url: "u", linked: true },
      { text: ", bye", url: null, linked: false },
    ]);
  });

  it("folds after three lines", () => {
    expect(isLongPost("a\nb\nc")).toBe(false);
    expect(isLongPost("a\nb\nc\nd")).toBe(true);
  });
});
