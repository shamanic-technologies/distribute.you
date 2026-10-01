import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOCS = join(__dirname, "../..");
const KIT = join(DOCS, "../landing/public/brand");
const read = (p: string) => readFileSync(p);

/**
 * The docs header and tab wore the retired green-dot mark while the homepage,
 * the dashboard and the docs' own link preview wore the brand kit's (2026-10-01:
 * "WTF ce logo dans la doc"). Every docs mark is now a byte copy of the kit.
 */
describe("the docs wear the brand-kit mark", () => {
  it("copies the kit byte for byte", () => {
    expect(read(join(DOCS, "public/brand/logo-mark.svg"))).toEqual(read(join(KIT, "logo-mark.svg")));
    expect(read(join(DOCS, "public/brand/logo-mark.png"))).toEqual(read(join(KIT, "logo-mark.png")));
    expect(read(join(DOCS, "src/app/icon.svg"))).toEqual(read(join(KIT, "icon.svg")));
    expect(read(join(DOCS, "src/app/apple-icon.png"))).toEqual(read(join(KIT, "apple-icon.png")));
  });

  it("ships no retired raster mark beside it", () => {
    for (const f of ["src/app/icon.jpg", "src/app/apple-icon.jpg", "public/favicon.jpg", "public/logo-head.jpg"]) {
      expect(existsSync(join(DOCS, f)), f).toBe(false);
    }
  });

  it("draws the kit mark in the header", () => {
    expect(readFileSync(join(DOCS, "src/components/docs-layout.tsx"), "utf8")).toContain('src="/brand/logo-mark.svg"');
  });
});
