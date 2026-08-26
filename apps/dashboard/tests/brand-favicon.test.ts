import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The browser tab shows the open brand's logo.
 *
 * Source-substring guards (the dashboard convention — the component imports
 * through the `@` alias, which vitest does not resolve in this repo).
 */
describe("Brand favicon", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const src = read("src/components/brand-favicon.tsx");
  const layout = read("src/app/(authed)/(dashboard)/layout.tsx");

  const sliceFrom = (haystack: string, marker: string, len: number) => {
    const at = haystack.indexOf(marker);
    expect(at, `${marker} must be present`).toBeGreaterThan(-1);
    return haystack.slice(at, at + len);
  };

  it("resolves the brand from the shared tenant switcher, not a re-inlined read", () => {
    // ONE implementation of tenant identity — `use-tenant-switcher.ts` already
    // parses the URL brand and holds the disk-backed `["brand", brandId]` read.
    expect(src).toContain("useTenantSwitcher()");
    expect(src).toContain("displayBrand?.domain");
    expect(src).not.toContain("getBrand(");
    expect(src).not.toContain("useParams");
  });

  it("serves the mark from logo.dev, the repo's single logo source", () => {
    expect(src).toContain("img.logo.dev");
    expect(src).toContain("pk_J1iY4__HSfm9acHjR8FibA");
  });

  it("swaps the tab icon only after the brand logo has actually decoded", () => {
    // logo.dev answers an unknown domain with a generated monogram, so the swap
    // is gated on a real load rather than fired optimistically.
    expect(src).toContain("new Image()");
    const onload = sliceFrom(src, "probe.onload", 120);
    expect(onload).toContain("applyBrandFavicon(src)");
  });

  it("keeps the distribute mark when the brand logo cannot load, and says so", () => {
    const onerror = sliceFrom(src, "probe.onerror", 240);
    expect(onerror).toContain("console.error");
    expect(onerror).toContain("restoreDefaultFavicon()");
  });

  it("restores the distribute mark when no brand is in the URL", () => {
    const guard = sliceFrom(src, "if (!domain)", 80);
    expect(guard).toContain("restoreDefaultFavicon()");
  });

  it("parks the app's own icon links instead of appending a competing one", () => {
    // Which of several `<link rel="icon">` a browser picks is unspecified, so the
    // default links get their `rel` blanked while a brand mark is showing.
    expect(src).toContain('link[rel~="icon"]');
    expect(src).toContain("PARKED_ATTR");
    expect(src).toContain('link.rel = ""');
  });

  it("keeps re-parking, because React owns the app's own icon links", () => {
    // `metadata.icons` renders those links inside the React tree, so a client
    // navigation re-renders them and the blanked `rel` comes back — two live
    // icon links, and the browser is free to take the distribute one. The brand
    // domain has not changed, so the effect never re-runs on its own.
    expect(src).toContain("new MutationObserver");
    expect(src).toContain("observer.observe(document.head");
    expect(src).toContain("observer?.disconnect()");
    // Re-entry guard: an apply mutates the head, which is what the observer
    // watches, so without the hold check it would re-apply forever.
    const callback = sliceFrom(src, "observer = new MutationObserver", 200);
    expect(callback).toContain("brandFaviconHolds(src)");
  });

  it("holds only when the brand mark is the SINGLE live icon link", () => {
    // A live sibling is the bug: which of several `<link rel="icon">` a browser
    // picks is unspecified. 220 chars measured to the closing brace.
    const holds = sliceFrom(src, "function brandFaviconHolds", 320);
    expect(holds).toContain("live.length === 1");
    expect(holds).toContain("MANAGED_ATTR");
  });

  it("wears the brand-kit mark, byte-equal with the one the landing ships", () => {
    // Both dashboard marks drifted to an older square-and-dot design while the
    // kit moved on, which is what read as "a weird distribute favicon".
    const kit = read("../landing/public/brand/favicon.svg");
    expect(read("public/logo-distribute.svg")).toBe(kit);
    expect(read("src/app/icon.svg")).toBe(kit);
  });

  it("is mounted once in the dashboard layout", () => {
    expect(layout).toContain('import { BrandFavicon } from "@/components/brand-favicon"');
    expect(layout).toContain("<BrandFavicon />");
  });
});
