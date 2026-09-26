import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  matchV1BrandRoot,
  parseUiVersion,
  stripV2Prefix,
  uiVersionCookieAssignment,
  v2DashboardHref,
  isV2Path,
} from "../src/lib/ui-version";
import { crewFor, crewInitial, crewKey } from "../src/lib/v2/crews";
import { cumulativeWindow, dailyWindow, windowDays } from "../src/lib/v2/series";
import { brandIdFromPathname } from "../src/lib/brand-tint-preload";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("ui-version", () => {
  it("reads only an exact v2 as v2", () => {
    expect(parseUiVersion("v2")).toBe("v2");
    expect(parseUiVersion("v1")).toBe("v1");
    expect(parseUiVersion(undefined)).toBe("v1");
    expect(parseUiVersion("V2")).toBe("v1");
  });

  it("writes a year-long, site-wide cookie, Secure only on https", () => {
    expect(uiVersionCookieAssignment("v2", true)).toBe(
      "distribute-ui=v2; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(uiVersionCookieAssignment("v1", false)).not.toContain("Secure");
  });

  it("strips the v2 prefix so v1 parsers read a v2 URL", () => {
    expect(stripV2Prefix("/v2/orgs/o/brands/b")).toBe("/orgs/o/brands/b");
    expect(stripV2Prefix("/v2")).toBe("/");
    expect(stripV2Prefix("/orgs/o")).toBe("/orgs/o");
    expect(stripV2Prefix("/v2x/orgs")).toBe("/v2x/orgs");
    expect(isV2Path("/v2/orgs/o")).toBe(true);
    expect(isV2Path("/v20")).toBe(false);
  });

  it("matches the v1 brand ROOT only, never a deeper page", () => {
    expect(matchV1BrandRoot("/orgs/o/brands/b")).toEqual({ orgId: "o", brandId: "b" });
    expect(matchV1BrandRoot("/orgs/o/brands/b/")).toEqual({ orgId: "o", brandId: "b" });
    expect(matchV1BrandRoot("/orgs/o/brands/b/leads")).toBeNull();
    expect(matchV1BrandRoot("/orgs/o/brands/b/offers/x")).toBeNull();
    expect(matchV1BrandRoot("/v2/orgs/o/brands/b")).toBeNull();
    expect(v2DashboardHref("o", "b")).toBe("/v2/orgs/o/brands/b");
  });

  it("the tint parser reads the same brand under /v2", () => {
    expect(brandIdFromPathname("/v2/orgs/o/brands/b")).toBe("b");
    expect(brandIdFromPathname("/orgs/o/brands/b")).toBe("b");
    expect(brandIdFromPathname("/v2/orgs/o")).toBeNull();
  });
});

describe("crews", () => {
  it("names a known (channel, landing step) pair, stably", () => {
    const scout = crewFor("sales-cold-email-outreach", "website_visit", "Cold email");
    expect(scout.name).toBe("Scout");
    expect(scout.key).toBe(crewKey("sales-cold-email-outreach", "website_visit"));
    expect(crewFor("sales-cold-email-outreach", "conversation", "Cold email").name).toBe("Herald");
  });

  it("names an unlisted pair by its channel, never an invented name", () => {
    expect(crewFor("google-ads", "website_visit", "Google Ads").name).toBe("Google Ads");
    expect(crewFor("x", null, "X").key).toBe("x|unplaced");
    expect(crewInitial("scout")).toBe("S");
  });
});

describe("series windows", () => {
  const today = "2026-09-26";
  it("lists the window oldest first, ending today", () => {
    expect(windowDays(3, today)).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
  });

  it("fills an absent day as zero and ignores days outside the window", () => {
    expect(
      dailyWindow(
        [
          { date: "2026-08-01", count: 9 },
          { date: "2026-09-24", count: 2 },
          { date: "2026-09-26", count: 5 },
        ],
        3,
        today,
      ),
    ).toEqual([2, 0, 5]);
    expect(dailyWindow(undefined, 2, today)).toEqual([0, 0]);
  });

  it("carries a cumulative value across a gap, and starts at zero", () => {
    expect(
      cumulativeWindow(
        [
          { date: "2026-09-20", value: 10 },
          { date: "2026-09-25", value: 14 },
        ],
        4,
        today,
      ),
    ).toEqual([10, 10, 14, 14]);
    expect(cumulativeWindow([{ date: "2026-09-26", value: 3 }], 2, today)).toEqual([0, 3]);
  });
});

describe("v2 wiring", () => {
  it("the edge honours the choice only for a beta email, and keeps Clerk synced under /v2", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain("isBetaEmail(sessionClaims?.email)");
    expect(proxy).toContain('parseUiVersion(req.cookies.get(UI_VERSION_COOKIE)?.value) === "v2"');
    expect(proxy).toContain("matchV1BrandRoot(pathname)");
    expect(proxy).toContain('"/v2/orgs/:id"');
  });

  it("the v2 tree is gated on the beta allowlist and wears the beta badge", () => {
    const layout = read("src/app/(authed)/v2/layout.tsx");
    expect(layout).toContain("isBetaEmail(user?.primaryEmailAddress?.emailAddress)");
    expect(layout).toContain("This page is not available");
    expect(read("src/components/v2/v2-shell.tsx")).toContain('<MaturityBadge level="beta" />');
  });

  it("the v1 sidebar offers the switch, beta-only and badged", () => {
    expect(read("src/components/context-sidebar.tsx")).toContain("<SwitchToV2 />");
    const sw = read("src/components/ui-version-switch.tsx");
    expect(sw).toContain("if (!isBeta) return null;");
    expect(sw).toContain('<MaturityBadge level="beta" />');
  });

  it("the Dashboard reads v1's keys and computes no metric", () => {
    const page = read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/page.tsx");
    expect(page).toContain('["brandRevenue", brandId]');
    expect(page).not.toMatch(/\.reduce\(/);
    const replies = read("src/components/v2/last-replies.tsx");
    expect(replies).toContain('["leadsPage", `brand:${brandId}`, "positive-replies", "", 0]');
    expect(existsSync(resolve(ROOT, "src/components/v2/use-missions.ts"))).toBe(true);
    expect(read("src/components/v2/use-missions.ts")).toContain("useCampaignRows(brandId, featureSlug, ALL_OFFERS)");
  });

  it("no em-dash in v2 copy", () => {
    for (const f of [
      "src/components/v2/v2-shell.tsx",
      "src/components/v2/missions-table.tsx",
      "src/components/v2/last-replies.tsx",
      "src/components/v2/performance-card.tsx",
      "src/app/(authed)/v2/layout.tsx",
    ]) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      // "—" is allowed only as the absent-value marker in a `"—"` string literal.
      const stripped = code.replace(/"—"/g, "");
      expect(stripped, f).not.toContain("—");
    }
  });
});
