import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The newsletter's two call-to-action buttons, read as a structure a mail client can render.
 *
 * Both shipped taking their ENTIRE height from a `line-height` on the anchor with zero
 * vertical padding, which is the one height mechanism a mail client is free to normalise
 * away: drop it and a 46px pill collapses to 20px, a coloured strip with its label spilling
 * out. Measured in a browser they were fine, which is exactly why a rendered check missed
 * it. They also wrapped to two lines inside a 100px-radius pill at 320px, which is a real
 * phone width.
 *
 * So both are built the way every email house builds a button: the background, the radius
 * and the PADDING live on a `<td>`, and the anchor only supplies the label. The height then
 * comes from padding, which no client discards.
 */

const ROOT = join(__dirname, "..", "..");
const html = readFileSync(join(ROOT, "content", "newsletters", "flash-vs-pro", "index.html"), "utf8");

/** The `<td>` wrapping each call-to-action anchor: `<td …>…<a …>Read …</a>…</td>`. */
const buttonCells = [...html.matchAll(/<td\b([^>]*)>\s*<a\b([^>]*)>\s*(Read the[^<]*)<\/a>\s*<\/td>/g)].map(
  (m) => ({ td: m[1], anchor: m[2], label: m[3].trim() }),
);

describe("the newsletter's call-to-action buttons", () => {
  it("are the two Read-the-study buttons and nothing else", () => {
    expect(buttonCells.map((b) => b.label)).toEqual(["Read the study", "Read the full study &rarr;"]);
  });

  it.each(buttonCells.map((b) => [b.label, b] as const))(
    "%s takes its height from padding on the cell, never from line-height on the anchor",
    (_label, button) => {
      // The cell carries the pill and the padding, so the button has a height whatever the
      // client does with line-height.
      expect(button.td).toMatch(/padding:\s*\d+px\s+\d+px/);
      expect(button.td).toMatch(/border-radius:\s*100px/);
      expect(button.td).toMatch(/background:\s*#[0-9a-f]{6}/i);
      // and a bgcolor attribute beside it, for a client that keeps the markup and drops the
      // style: a transparent pill with white text on it is an invisible button.
      expect(button.td).toMatch(/bgcolor="#[0-9a-f]{6}"/i);

      // The anchor states no padding and no height-bearing line-height.
      expect(button.anchor).not.toMatch(/padding/);
      const lineHeight = button.anchor.match(/line-height:\s*(\d+)px/)?.[1];
      expect(lineHeight, "the anchor states a line-height").toBeTruthy();
      expect(
        Number(lineHeight),
        "a line-height above the font size is the anchor carrying the height again",
      ).toBeLessThanOrEqual(20);
    },
  );

  it.each(buttonCells.map((b) => [b.label, b] as const))("%s keeps its label on one line", (_label, button) => {
    // At 320px both labels wrapped inside a 100px-radius pill, which reads as a blob.
    expect(button.anchor).toMatch(/white-space:\s*nowrap/);
  });

  it.each(buttonCells.map((b) => [b.label, b] as const))("%s is a real tap target", (_label, button) => {
    // Vertical padding plus the label's line box. Under about 40px a pill is a fiddly tap on
    // a phone; Apple and Google both ask for more.
    const pad = Number(button.td.match(/padding:\s*(\d+)px/)![1]);
    const line = Number(button.anchor.match(/line-height:\s*(\d+)px/)![1]);
    expect(pad * 2 + line).toBeGreaterThanOrEqual(40);
  });

  it("both point at the article, with the newsletter's own campaign tag", () => {
    for (const button of buttonCells) {
      expect(button.anchor).toMatch(
        /href="https:\/\/distribute\.you\/blog\/flash-vs-pro-llm-cold-email\?utm_source=newsletter&utm_medium=email&utm_campaign=flash-vs-pro"/,
      );
    }
  });
});
