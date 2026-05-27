import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function read(relative: string): string {
  return fs.readFileSync(path.resolve(__dirname, relative), "utf-8");
}

describe("Get Started CTAs route to /get-started gate (not direct signup)", () => {
  it("navbar desktop + mobile + dropdown all link to /get-started", () => {
    const navbar = read("../../src/components/navbar.tsx");
    const desktopMatch = navbar.match(/href="\/get-started"/g) || [];
    // Three Get-Started entries: desktop, mobile-condensed, mobile-dropdown
    expect(desktopMatch.length).toBeGreaterThanOrEqual(3);
    // No CTA falls back to urls.signUp anymore
    expect(navbar).not.toMatch(/href=\{urls\.signUp\}[\s\S]{0,80}Get Started/);
    expect(navbar).not.toMatch(/href=\{urls\.signUp\}[\s\S]{0,80}Start/);
  });

  it("hero form submits to /get-started", () => {
    const hero = read("../../src/components/hero-form.tsx");
    expect(hero).toContain("/get-started");
    expect(hero).not.toMatch(/signUpUrl\}\?/);
  });
});
