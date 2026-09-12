import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The link-scanner correction, as the two data articles state it.
 *
 * Both pages explain that a corporate mail gateway fetches every URL before the reader sees
 * it, and that such a hit is classified before it counts. Two things about that paragraph
 * kept going stale, and both are the kind nothing else would catch.
 *
 * The FIGURE was typed. "271 of 309 such hits were demoted" was the only number on either
 * page that the pipeline did not derive, so it froze the day it was written while the sweep
 * kept classifying: production read 366 of 411 for the same window a day later, and the
 * number only grows. It is a token now, off `tracking_hits_raw`.
 *
 * The SCOPE was understated. The correction reaches our own `/c/` redirect and nothing else,
 * which the paragraph did say, and a reader seeing "366 of 411 demoted" reasonably concludes
 * the bulk of the volume was scrubbed. It was not: the redirect only started carrying traffic
 * in late August, so the provider's own tracking accounts for nearly every click either page
 * prices. The paragraph states that share rather than leaving it to be assumed.
 */

const ARTICLES = ["cost-per-click-cold-email", "flash-vs-pro-llm-cold-email"] as const;

function read(slug: string, file: string): string {
  return readFileSync(join(__dirname, "..", "..", "content", "blog", slug, file), "utf8");
}

/** The Method bullet that explains the correction, tags stripped. */
function scannerBullet(html: string): string {
  const bullet = /<li><strong>Link scanners<\/strong>:[\s\S]*?<\/li>/.exec(html);
  if (!bullet) throw new Error("no Link scanners bullet");
  return bullet[0].replace(/<[^>]+>/g, "");
}

describe.each(ARTICLES)("%s: the link-scanner correction", (slug) => {
  const html = read(slug, "article.html");
  const template = read(slug, "article.template.html");
  const bullet = scannerBullet(html);

  it("states the demotion as a DERIVED figure, never a typed one", () => {
    // The template holds tokens; only the rendered page holds numbers.
    const templateBullet = scannerBullet(template);
    expect(templateBullet).toContain("{{n scanner.demoted}} of {{n scanner.decided}}");
    expect(templateBullet).not.toMatch(/\d+ of \d+ such hits/);
    // and the rendered page resolved them to a real pair
    const demoted = /(\d[\d,]*) of (\d[\d,]*) such hits were demoted/.exec(bullet);
    expect(demoted).not.toBeNull();
    const [, dem, decided] = demoted!;
    expect(Number(dem.replace(/,/g, ""))).toBeGreaterThan(0);
    expect(Number(dem.replace(/,/g, ""))).toBeLessThanOrEqual(Number(decided.replace(/,/g, "")));
  });

  it("says the correction does not reach the provider's own tracking, and how much that is", () => {
    expect(bullet).toContain("Clicks the sending provider reports on its own infrastructure are not affected");
    const share = /(\d[\d,]*) of the (\d[\d,]*) clicks counted here come from its tracking, (\d[\d,]*) from our own redirect/.exec(bullet);
    expect(share).not.toBeNull();
    const [, provider, total, own] = (share ?? []).map((n) => Number(String(n).replace(/,/g, "")));
    // the two sources partition the clicks the page prices; anything else is a wrong figure
    expect(provider + own).toBe(total);
    expect(own).toBeGreaterThan(0);
  });

  it("the share is a token too, so a re-derivation moves it", () => {
    const templateBullet = scannerBullet(template);
    expect(templateBullet).toContain("{{n volume.clicksBySource.provider}}");
    expect(templateBullet).toContain("{{n volume.clicksBySource.selfSend}}");
    expect(templateBullet).toContain("{{n volume.clicks}}");
  });

  it("no typed scanner figure survives anywhere on the page", () => {
    // The retired literal, and the shape of any hand-typed replacement for it.
    expect(template).not.toContain("271 of 309");
    expect(html).not.toContain("271 of 309");
  });
});

describe("the derivation exposes what the paragraph states", () => {
  const derive = readFileSync(join(__dirname, "..", "..", "scripts", "blog-data", "derive.mjs"), "utf8");
  const extract = readFileSync(join(__dirname, "..", "..", "scripts", "blog-data", "extract.sh"), "utf8");

  it("extract pulls the bronze verdicts, scoped to the same window as everything else", () => {
    expect(extract).toContain("scanner-hits.csv");
    expect(extract).toContain("FROM tracking_hits_raw");
    expect(extract).toContain("kind = 'click'");
    expect(extract).toContain("received_at >= '$FROM' AND received_at < '$TO'");
  });

  it("derive divides by the DECIDED hits, so a pending verdict cannot inflate the share", () => {
    // A hit awaiting its verdict is neither promoted nor demoted; counting it as a
    // denominator would understate the demotion rate for as long as the sweep lags.
    expect(derive).toContain("decided: human + demoted");
    expect(derive).toContain("undecided");
  });

  it("derive fails loud on an absent or unreadable scanner read", () => {
    expect(derive).toContain("scanner-hits.csv is empty: re-run extract.sh");
    expect(derive).toMatch(/scanner-hits\.csv is not numeric/);
  });

  it("the click source is carried from the click row, never guessed", () => {
    expect(derive).toContain('clickSource: click ? click.source : null');
    expect(derive).toContain('f.clickSource === "self_send"');
  });
});
