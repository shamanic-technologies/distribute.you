import { describe, it, expect } from "vitest";
import {
  brandIdFromPathname,
  BRAND_TINT_PRELOAD_SCRIPT,
} from "../src/lib/brand-tint-preload";
import { TINT_ATTR, HUE_VAR, CHROMA_VAR, DELTA_VAR } from "../src/lib/brand-tint";
import {
  TENANT_IDENTITY_COOKIE,
  serializeTenantIdentityCookie,
  TENANT_IDENTITY_VERSION,
  type TenantIdentitySnapshot,
} from "../src/lib/tenant-identity-cookie";

const BRAND = "73f4706e-0706-4f8c-a2af-14d9d645b93e";
const PATH = `/orgs/org_3JQXSg/brands/${BRAND}/offers/90a51a50/funnels/sales_meetings`;

function snapshot(brands: TenantIdentitySnapshot["brands"]): TenantIdentitySnapshot {
  return { v: TENANT_IDENTITY_VERSION, orgs: {}, brands };
}

/**
 * Run the real shipped script against stubbed globals. `new Function` binds the
 * two free variables it reads, so this exercises the exact string the root layout
 * renders — not a re-implementation of it, which is the only version of this test
 * that can catch a broken script.
 */
function runScript(pathname: string, cookie: string) {
  const props = new Map<string, string>();
  const attrs = new Map<string, string>();
  const root = {
    style: {
      setProperty: (k: string, v: string) => props.set(k, v),
      removeProperty: (k: string) => props.delete(k),
    },
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    removeAttribute: (k: string) => attrs.delete(k),
  };
  const document = { cookie, documentElement: root };
  const location = { pathname };
  new Function("document", "location", BRAND_TINT_PRELOAD_SCRIPT)(document, location);
  return { props, attrs };
}

function cookieFor(snap: TenantIdentitySnapshot, extra = ""): string {
  const row = `${TENANT_IDENTITY_COOKIE}=${serializeTenantIdentityCookie(snap)}`;
  return extra ? `${extra}; ${row}` : row;
}

describe("brandIdFromPathname", () => {
  it("reads the brand out of a real dashboard path, however deep", () => {
    expect(brandIdFromPathname(PATH)).toBe(BRAND);
    expect(brandIdFromPathname(`/orgs/o/brands/${BRAND}`)).toBe(BRAND);
    expect(brandIdFromPathname(`/orgs/o/brands/${BRAND}/audiences/leads`)).toBe(BRAND);
  });

  it("answers null wherever no brand is in scope", () => {
    // The org root, billing and the API-key page carry no brand — and a surface
    // with no brand must carry no tint, or a client navigation off a brand page
    // would keep a colour a hard load of the same URL never paints.
    expect(brandIdFromPathname("/orgs/o")).toBeNull();
    expect(brandIdFromPathname("/orgs/o/billing")).toBeNull();
    expect(brandIdFromPathname("/orgs/o/brands")).toBeNull();
    expect(brandIdFromPathname("/onboarding")).toBeNull();
    expect(brandIdFromPathname("/")).toBeNull();
  });
});

describe("BRAND_TINT_PRELOAD_SCRIPT", () => {
  it("paints the open brand's remembered tint", () => {
    const { props, attrs } = runScript(
      PATH,
      cookieFor(snapshot({ [BRAND]: { n: "Acme", d: "acme.com", t: { h: 12.4, c: 0.9, r: -245.6 } } })),
    );
    expect(props.get(HUE_VAR)).toBe("12.4");
    expect(props.get(CHROMA_VAR)).toBe("0.9");
    expect(props.get(DELTA_VAR)).toBe("-245.6");
    expect(attrs.has(TINT_ATTR)).toBe(true);
  });

  it("finds its own row among other cookies", () => {
    const { attrs } = runScript(
      PATH,
      cookieFor(
        snapshot({ [BRAND]: { n: "Acme", d: "acme.com", t: { h: 12.4, c: 0.9, r: -245.6 } } }),
        "__session=abc; last-brand-org_x=y",
      ),
    );
    expect(attrs.has(TINT_ATTR)).toBe(true);
  });

  it("paints nothing when no brand is in the path", () => {
    const { props, attrs } = runScript(
      "/orgs/org_3JQXSg/billing",
      cookieFor(snapshot({ [BRAND]: { n: "Acme", d: "acme.com", t: { h: 12.4, c: 0.9, r: -245.6 } } })),
    );
    expect(props.size).toBe(0);
    expect(attrs.size).toBe(0);
  });

  it("paints nothing for a brand this browser has never opened", () => {
    // The honest first frame for an unknown brand is the charter blue: we do not
    // know its colour yet, and inventing one is worse than a late repaint.
    const { attrs } = runScript(PATH, cookieFor(snapshot({ "other-brand": { n: "Other", d: null } })));
    expect(attrs.size).toBe(0);
  });

  it("paints nothing for a brand we know the NAME of but not the colours", () => {
    const { attrs } = runScript(PATH, cookieFor(snapshot({ [BRAND]: { n: "Acme", d: "acme.com" } })));
    expect(attrs.size).toBe(0);
  });

  it("refuses a partial tint rather than painting half of one", () => {
    const raw = `${TENANT_IDENTITY_COOKIE}=${encodeURIComponent(
      JSON.stringify({ v: TENANT_IDENTITY_VERSION, orgs: {}, brands: { [BRAND]: { n: "A", d: null, t: { h: 12.4, c: 0.9 } } } }),
    )}`;
    const { props, attrs } = runScript(PATH, raw);
    expect(props.size).toBe(0);
    expect(attrs.size).toBe(0);
  });

  it("ignores a stale version rather than reading fields that may have moved", () => {
    const raw = `${TENANT_IDENTITY_COOKIE}=${encodeURIComponent(
      JSON.stringify({ v: TENANT_IDENTITY_VERSION + 1, orgs: {}, brands: { [BRAND]: { t: { h: 1, c: 1, r: 1 } } } }),
    )}`;
    expect(runScript(PATH, raw).attrs.size).toBe(0);
  });

  it("survives a hand-edited cookie without throwing", () => {
    // Not httpOnly, so a malformed blob is an expected input rather than an
    // internal error — and a throw here would land on every page load.
    for (const raw of [
      `${TENANT_IDENTITY_COOKIE}=not-json`,
      `${TENANT_IDENTITY_COOKIE}=%E0%A4%A`,
      `${TENANT_IDENTITY_COOKIE}=`,
      `${TENANT_IDENTITY_COOKIE}=${encodeURIComponent("null")}`,
      `${TENANT_IDENTITY_COOKIE}=${encodeURIComponent('{"v":1}')}`,
      "",
    ]) {
      expect(() => runScript(PATH, raw)).not.toThrow();
      expect(runScript(PATH, raw).attrs.size).toBe(0);
    }
  });

  it("resolves nothing itself — the OKLCH maths stays in one place", () => {
    // A second implementation of resolveBrandTint here is how the first frame and
    // the hydrated frame would come to disagree about one brand's hue.
    expect(BRAND_TINT_PRELOAD_SCRIPT).not.toMatch(/cbrt|atan2|oklch/i);
    expect(BRAND_TINT_PRELOAD_SCRIPT).not.toContain("colors");
  });
});
