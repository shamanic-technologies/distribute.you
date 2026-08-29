import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const homepagePath = path.resolve(
  __dirname,
  "../../public/landing/index-v1.html",
);
const html = fs.readFileSync(homepagePath, "utf8");

const navLinks = html.slice(
  html.indexOf('<div class="nav-links"'),
  html.indexOf('<div class="nav-actions">'),
);

describe("an existing customer can log in at every width", () => {
  // The homepage carries its own inline nav rather than components.js, and its
  // mobile rules hide `.login-link` at 820px and the header button at 620px.
  // The collapsed menu held only the five section anchors, so below 820px there
  // was no sign-in path on the page at all.
  it("puts Log in inside the collapsed menu", () => {
    expect(navLinks).toContain(
      '<a class="nav-menu-auth" data-auth="login" href="https://dashboard.distribute.you/sign-in">Log in</a>',
    );
  });

  it("puts Launch campaign there too, for the width that hides the header button", () => {
    expect(navLinks).toContain(
      '<a class="nav-menu-auth" data-auth="signup" href="https://dashboard.distribute.you/sign-up">Launch campaign</a>',
    );
  });

  it("hides both menu entries on desktop, where the header already states them", () => {
    expect(html).toContain(".nav-menu-auth{display:none}");
  });

  it("reveals Log in exactly where the header link is hidden", () => {
    // Same media block that sets `.login-link{display:none}`.
    const mobile = html.slice(
      html.indexOf("@media(max-width:820px)"),
      html.indexOf("@media(max-width:620px)"),
    );
    expect(mobile).toContain(".login-link{display:none}");
    expect(mobile).toContain(
      '.nav-links .nav-menu-auth[data-auth="login"]{display:block}',
    );
  });

  it("reveals Launch campaign exactly where the header button is hidden", () => {
    const narrow = html.slice(html.indexOf("@media(max-width:620px)"));
    expect(narrow).toContain(".nav-actions>.button{display:none}");
    expect(narrow).toContain(
      '.nav-links .nav-menu-auth[data-auth="signup"]{display:block}',
    );
  });
});
