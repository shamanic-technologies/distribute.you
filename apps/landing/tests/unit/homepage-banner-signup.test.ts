import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const homepagePath = path.resolve(
  __dirname,
  "../../public/landing/index-v1.html",
);
const html = fs.readFileSync(homepagePath, "utf8");

const SIGN_UP_URL = "https://dashboard.distribute.you/sign-up";

describe("the $400 announcement bar is clickable across its whole width", () => {
  // The bar advertised the credits with no click target at all, while the date
  // inside it was underlined -- so it read as a link and did nothing. The whole
  // bar is now the affordance, pointing at the same sign-up URL as every other
  // CTA on the page.
  it("renders the bar as an anchor to sign-up", () => {
    expect(html).toContain(`<a class="announcement" href="${SIGN_UP_URL}"`);
  });

  it("leaves no inert div version of the bar behind", () => {
    expect(html).not.toContain('<div class="announcement">');
  });

  it("keeps the announcement copy inside the anchor", () => {
    const anchorStart = html.indexOf('<a class="announcement"');
    const anchorEnd = html.indexOf("</a>", anchorStart);
    const bar = html.slice(anchorStart, anchorEnd);
    // The centred wrap must sit INSIDE the anchor, otherwise only the text is
    // clickable and the padding either side of it is dead.
    expect(bar).toContain('class="wrap announcement-inner"');
    expect(bar).toContain("in matched credits until");
  });

  it("names the destination for screen readers", () => {
    const anchorStart = html.indexOf('<a class="announcement"');
    const openTag = html.slice(anchorStart, html.indexOf(">", anchorStart));
    expect(openTag).toContain("aria-label=");
  });

  it("strips the inherited link styling from the bar", () => {
    const cssStart = html.indexOf(".announcement{");
    const cssEnd = html.indexOf("}", cssStart);
    const rule = html.slice(cssStart, cssEnd);
    // A full-width anchor still renders as an inline underlined link unless
    // both are overridden, and the bar must not look like body-copy link text.
    expect(rule).toContain("display:block");
    expect(rule).toContain("text-decoration:none");
  });

  it("gives the bar a hover state so it reads as clickable", () => {
    expect(html).toContain(".announcement:hover{");
  });
});
