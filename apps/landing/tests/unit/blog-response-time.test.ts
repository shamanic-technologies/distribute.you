import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The article `cold-email-response-time` states the Research study `positive-reply-delay` as
 * features-service served it (committed snapshot, `scripts/blog-data/reply-delay/`). Owner rule
 * (2026-10-21): the title and the takeaway carry the study's CONCLUSION only ("at least N%
 * within 24 hours"); the follow-up waves are a SIGNAL, labelled so in the body; exact shares,
 * ranges and counts live in the notes.
 */
const root = join(__dirname, "../..");
const slug = "cold-email-response-time";
const dir = join(root, "content/blog", slug);
const html = readFileSync(join(dir, "article.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const { study } = JSON.parse(readFileSync(join(root, "scripts/blog-data/reply-delay/reply-delay.snapshot.json"), "utf8"));
const floor = Number(/^At least (\d+)%/.exec(study.headline)?.[1]);
const text = (s: string) => s.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const card = text(html.slice(html.indexOf("Key takeaway"), html.indexOf("</div>")));
const body = text(html.slice(html.indexOf('id="the-question"'), html.indexOf('id="notes"')));
const notes = text(html.slice(html.indexOf('id="notes"')));

describe("the cold email response time article", () => {
  it("rests on a study the producer serves as a conclusion", () => {
    expect(study.id).toBe("positive-reply-delay");
    expect(study.verdict.kind).toBe("conclusion");
    expect(floor).toBeGreaterThanOrEqual(30);
  });

  it("puts only the conclusion in the title and the takeaway", () => {
    expect(meta.title).toContain(`${floor}%+ of Positive Replies in 24h`);
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(card).toContain(`At least ${floor}% of positive replies to our cold emails arrive within 24 hours of the first email.`);
    // no exact share, range, count or wave figure up top
    expect(card.replace(`${floor}%`, "").replace(/(24|48) hours/g, "")).not.toMatch(/\d/);
    expect(meta.title + meta.excerpt).not.toMatch(/day 10|wave|median|42%/i);
  });

  it("labels the follow-up waves a signal and keeps exact figures in the notes", () => {
    expect(body).toContain("Our early signal is that each follow-up brings its own wave");
    expect(body).toContain("This is a signal, not yet a conclusion.");
    expect(body).not.toMatch(/\d+ of \d+|\d+%(?! of first positive replies arrive)|Wilson|median/);
    const n = study.delay.sampleSize;
    const day1 = study.charts[0].curve.points.find((p: { key: string }) => p.key === "12h_1d");
    const k = /^(\d+) of/.exec(day1.note)?.[1];
    expect(notes).toContain(`${day1.display} (${k} of ${n})`);
    expect(notes).toContain(`${n} first positive replies`);
    expect(notes).toContain("signals only");
  });

  it("follows the blog writing rules", () => {
    expect(html).not.toMatch(/[—–]/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
    expect(html).toContain("Revenue made easy");
    expect(html).toContain('<a href="https://distribute.you">Get started: distribute.you</a>');
    expect(html).toContain('href="/blog/cold-email-follow-up"');
    expect(new Date(meta.publishedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
