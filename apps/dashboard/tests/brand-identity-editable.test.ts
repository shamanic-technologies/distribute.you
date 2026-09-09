import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf-8");

const CARD = read("src/components/settings/brand-identity-card.tsx");
const PAGE = read(
  "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
);
const LOGO = read("src/components/brand-logo.tsx");
const FAVICON = read("src/components/brand-favicon.tsx");
const SWITCHER = read("src/lib/use-tenant-switcher.ts");
const COOKIE = read("src/lib/tenant-identity-cookie.ts");
const API = read("src/lib/api.ts");

/**
 * A stored logo BEATS the logo.dev crawl, everywhere.
 *
 * The order is the whole feature. logo.dev is a crawl, so it is right until it is
 * not: it served our own brand under an identity we retired in July for two
 * months, on every sidebar and every tab, with nobody able to correct it. A
 * crawled guess must never win over a stated logo — and a surface that resolves
 * the mark on its own is how one of them ends up disagreeing with the others.
 */
describe("the stored logo wins over the crawl", () => {
  it("BrandLogo reads the stored one FIRST and falls back to the domain", () => {
    const storedAt = LOGO.indexOf("const stored =");
    const derivedAt = LOGO.indexOf("const derived =");
    expect(storedAt).toBeGreaterThan(-1);
    expect(derivedAt).toBeGreaterThan(storedAt);
    // The fallback is the crawl, not the globe: the brand still has a domain.
    expect(LOGO).toContain("img.logo.dev");
  });

  it("the tab favicon resolves through the SAME precedence, not its own", () => {
    const storedAt = FAVICON.indexOf("const stored = brand.logoUrl");
    const derivedAt = FAVICON.indexOf("img.logo.dev");
    expect(storedAt).toBeGreaterThan(-1);
    expect(derivedAt).toBeGreaterThan(storedAt);
  });

  it("the favicon effect depends on the resolved SRC, never the brand object", () => {
    // The brand object is rebuilt every render, and re-running the effect tears the
    // mark down (its cleanup restores the distribute one) and rebuilds it — a flip
    // on every poll, which is the class of bug this feature exists to end.
    expect(FAVICON).toContain("}, [src]);");
    expect(FAVICON).not.toContain("}, [domain]);");
  });

  it("every brand-scoped call site passes the stored logo", () => {
    // A surface left on `domain` alone silently keeps drawing the crawl, and
    // nothing goes red — it simply disagrees with the sidebar beside it.
    for (const [file, marker] of [
      ["src/components/tenant-switcher.tsx", "logoUrl={t.displayBrand?.logoUrl}"],
      ["src/components/tenant-switcher.tsx", "logoUrl={b.logoUrl}"],
      ["src/components/breadcrumb-nav.tsx", "logoUrl={displayBrand.logoUrl}"],
      ["src/components/breadcrumb-nav.tsx", "logoUrl={b.logoUrl}"],
      ["src/app/(authed)/(dashboard)/orgs/[orgId]/page.tsx", "logoUrl={brand.logoUrl}"],
      ["src/components/audiences/lead-scope-cards.tsx", "logoUrl={displayBrand?.logoUrl}"],
    ] as const) {
      expect(read(file), `${file} still draws the crawl`).toContain(marker);
    }
  });
});

/**
 * The first FRAME, which no client cache can win.
 *
 * The per-query IndexedDB restore runs in an effect, strictly after paint, so
 * without the cookie the tab and the rail draw the crawled mark and swap to the
 * real one a beat later — the exact flip this feature removes.
 */
describe("the stored logo is in the server-read cookie", () => {
  it("the remembered brand carries it, optionally", () => {
    expect(COOKIE).toContain("l?: string;");
  });

  it("a change to the logo alone re-writes the cookie", () => {
    expect(COOKIE).toContain("base.brands[brandId]?.l !== brand.l");
  });

  it("the switcher seeds from it and remembers it", () => {
    expect(SWITCHER).toContain("logoUrl: seededBrand.l ?? null");
    expect(SWITCHER).toContain("const rememberedBrandLogo");
    // Only a REAL logo is remembered: a brand with none omits the key rather than
    // asserting "nobody chose one" about a brand we have not read yet.
    expect(SWITCHER).toContain("displayBrand?.logoUrl || undefined");
  });
});

describe("the identity card", () => {
  it("is mounted on Brand Settings", () => {
    expect(PAGE).toContain("<BrandIdentityCard brandId={brandId} />");
  });

  it("does NOT edit the domain — that is the brand's key and keeps its own card", () => {
    // A website belongs to one brand at a time and moving it resolves a conflict
    // against whoever holds it. A name and a logo change without consequence.
    expect(CARD).not.toContain("attachBrandWebsite");
  });

  it("clears the logo with null, which is NOT the same as omitting the field", () => {
    // Omitted leaves what is stored; null is the instruction that puts the brand
    // back on the logo found from its website.
    expect(CARD).toContain("setLogoUrl(null)");
    expect(API).toContain('if ("logoUrl" in patch) body.logoUrl = patch.logoUrl;');
  });

  it("sends only what MOVED, so saving a name cannot overwrite a logo", () => {
    expect(CARD).toContain("logoUrl !== savedLogo ? { logoUrl } : {}");
    expect(CARD).toContain("name.trim() !== savedName.trim() ? { name: name.trim() } : {}");
  });

  it("arms Save on a LIVE compare, so typing a change and undoing it disarms it", () => {
    expect(CARD).toContain("const dirty =");
    // A sticky boolean latch stays true forever once touched.
    expect(CARD).not.toContain("const [dirty, setDirty]");
  });

  it("re-seeds from a payload IDENTITY change, never a once-per-mount latch", () => {
    // A latch seeds from the DISK snapshot and ignores the fresher server answer
    // that lands a beat later — which is how a saved value renders blank.
    expect(CARD).toContain("seededFrom.current === brand");
  });

  it("refuses a file BEFORE uploading it, and the URL AFTER", () => {
    expect(CARD).toContain("logoFileProblem(file)");
    expect(CARD).toContain("logoUrlProblem(url)");
  });

  it("uploads to OUR storage — a logo is never a URL somebody pasted", () => {
    // A pasted URL points at a file we do not hold: it can move, expire or start
    // refusing hotlinks, and the brand then wears a broken image with nothing in
    // our own logs to say what changed.
    expect(CARD).toContain("uploadOrgImage");
    expect(CARD).toContain('type="file"');
    expect(CARD).not.toContain('type="url"');
  });

  it("writes the answer into the shared brand cache so every mark moves with it", () => {
    // That key is what the sidebar mark, the tab favicon and the scope cards read.
    expect(CARD).toContain('queryClient.setQueryData(\n        ["brand", brandId]');
    // The dropdown reads a DIFFERENT key carrying the same two fields; without
    // this the brand renames everywhere except in the list you renamed it from.
    expect(CARD).toContain('queryKey: ["brands"]');
  });

  it("never renders a raw error body at a customer", () => {
    // api-service stringifies the whole downstream body into `message`.
    expect(CARD).not.toContain("error.message");
    expect(CARD).toContain("console.error");
  });
});
