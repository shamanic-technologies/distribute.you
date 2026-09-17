import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

const LAYOUT = read("app/layout.tsx");
const COMPONENT = read("components/brand-tint.tsx");
const SWITCHER = read("lib/use-tenant-switcher.ts");
const PRELOAD = read("lib/brand-tint-preload.ts");
const TINT_LIB = read("lib/brand-tint.ts");

/**
 * Source guards for the half the unit tests cannot reach: whether the script is
 * MOUNTED, whether the tint is WRITTEN BACK, and whether the component still
 * clears a brand it has not read yet. A pre-paint script nobody renders is the
 * feature entirely absent with the module perfectly correct.
 */
describe("the brand tint is painted in the first frame", () => {
  it("renders the pre-paint script in the root head", () => {
    expect(LAYOUT).toContain("BRAND_TINT_PRELOAD_SCRIPT");
    const head = LAYOUT.slice(LAYOUT.indexOf("<head>"), LAYOUT.indexOf("</head>"));
    expect(head).toContain("BRAND_TINT_PRELOAD_SCRIPT");
  });

  it("renders it BEFORE the analytics tags, because it must run before paint", () => {
    const head = LAYOUT.slice(LAYOUT.indexOf("<head>"), LAYOUT.indexOf("</head>"));
    expect(head.indexOf("BRAND_TINT_PRELOAD_SCRIPT")).toBeLessThan(head.indexOf("googletagmanager"));
  });

  it("renders it BLOCKING — an async script paints after the frame it exists to fix", () => {
    const tag = LAYOUT.slice(
      LAYOUT.indexOf("BRAND_TINT_PRELOAD_SCRIPT") - 200,
      LAYOUT.indexOf("BRAND_TINT_PRELOAD_SCRIPT") + 60,
    );
    expect(tag).not.toContain("async");
    expect(tag).not.toContain("defer");
  });

  it("writes the resolved tint back to the cookie", () => {
    // Without this the script has nothing to read on the next load and the whole
    // mechanism degrades to exactly the flash it replaces.
    expect(SWITCHER).toContain("resolveBrandTint(displayBrand.colors)");
    const remember = SWITCHER.slice(
      SWITCHER.indexOf("rememberIdentity({"),
      SWITCHER.indexOf("rememberIdentity,"),
    );
    expect(remember).toContain("h: rememberedBrandTintHue");
    expect(remember).toContain("c: rememberedBrandTintChroma");
    expect(remember).toContain("r: rememberedBrandTintDelta");
  });

  it("leaves the painted tint alone while the brand's colours are unresolved", () => {
    // The load-bearing half. Clearing here would rip the script's answer off at
    // hydration and re-apply it a second later — a worse flash than the original,
    // because it runs in the other direction.
    const body = COMPONENT.slice(COMPONENT.indexOf("export function BrandTint()"));
    expect(body).toContain("const unresolved = !!brandId && !colors;");
    expect(body).toContain("if (unresolved) return;");
    expect(body).toContain("[unresolved, hue, chromaScale, hueDelta]");
  });

  it("still clears where no brand is in scope at all", () => {
    // A client navigation off a brand must land where a hard load of that URL
    // lands, and the script paints nothing on an org-scoped page.
    const body = COMPONENT.slice(COMPONENT.indexOf("export function BrandTint()"));
    expect(body).toContain("const { brandId, displayBrand } = useTenantSwitcher();");
    expect(body).toContain("clear();");
  });

  it("reads ONE set of variable names, shared by both writers", () => {
    for (const name of ["TINT_ATTR", "HUE_VAR", "CHROMA_VAR", "DELTA_VAR"]) {
      expect(TINT_LIB).toContain(`export const ${name} =`);
    }
    // Neither writer may re-declare them — two spellings of one variable is how
    // the first frame and the hydrated frame paint different colours.
    expect(COMPONENT).not.toMatch(/const\s+TINT_ATTR\s*=/);
    expect(PRELOAD).not.toMatch(/const\s+HUE_VAR\s*=/);
  });

  it("reads ONE rule for which brand is open", () => {
    expect(SWITCHER).toContain("brandIdFromPathname(pathname)");
    expect(PRELOAD).toContain("export function brandIdFromPathname");
  });

  it("keeps the preload module alias-free so it carries real unit tests", () => {
    expect(PRELOAD).not.toContain('from "@/');
  });
});
