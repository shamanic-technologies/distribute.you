import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { navHtml } from "../../src/lib/site-chrome";
import { priceHtml } from "../../src/lib/pages/gtm-agency";

const APP = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(APP, p), "utf8");

describe("the menu opens on a click (owner 2026-11-18: a click reloaded the page)", () => {
  it("each menu title is a button, never a link to a page", () => {
    const nav = navHtml("/gtm-agency");
    expect(nav).toContain('<button type="button" class="nav-top" aria-haspopup="true"');
    expect(nav).not.toContain('<a class="nav-top"');
    expect(read("src/components/navbar.tsx")).not.toContain("<a href={g.href} aria-haspopup");
  });

  it("the page each title used to lead to is still one click away inside its menu", () => {
    const nav = navHtml("/");
    expect(nav).toContain('<a class="nav-item" href="/">');
    expect(nav).toContain('<a class="nav-item" href="/gtm-agency">');
  });
});

describe("the Distry skin stays readable", () => {
  const skin = read("public/landing/distry/skin.css");

  it("a band the live page designs dark keeps the night, so its white type stays readable", () => {
    expect(skin).toContain("html.distry section.d-day:is(.dark, .ag-dark, .ag-story) {");
    expect(skin).not.toContain("html.distry section.d-day.dark, html.distry section.d-day.dark :is(h2, h3) { color: var(--ink); }");
    expect(skin).not.toContain("html.distry .cta-box { background: #ffffff");
  });

  it("the nav stays above every band", () => {
    expect(skin).toContain("html.distry body > .nav { position: sticky !important; z-index: 50 !important; }");
  });

  it("Distry himself is the chat button, never a disc", () => {
    for (const css of [skin, read("public/landing/distry/home.css")]) {
      expect(css).not.toMatch(/\.buddy-face \{[^}]*border-radius: 50%/);
    }
    expect(read("src/lib/distry-skin.ts")).toContain('class="buddy-face"');
    expect(read("src/lib/distry-skin.ts")).toMatch(/buddy-face"[^>]*><img src="\$\{SKIN_ASSETS\}\/assets\/distry-logo\.svg"/);
  });
});

describe("the agency price sells what the client gets", () => {
  it("leads with the team, never with a fee that grows", () => {
    const html = priceHtml();
    expect(html).toContain("<h2>A whole growth team, from $1K a month.</h2>");
    expect(html).not.toContain("One fee that grows with your budget");
    expect(html).not.toMatch(/—|–/);
  });
});
