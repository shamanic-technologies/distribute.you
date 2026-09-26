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
    expect(crewFor("some-new-channel", "website_visit", "Some channel").name).toBe("Some channel");
    // Every channel we fund today has a teammate's name, whatever leg it lands on.
    expect(crewFor("ai-meeting-booking", "meeting_booked", "AI meeting booking").name).toBe("Pilot");
    expect(crewFor("pr-cold-email-outreach", null, "PR cold email").name).toBe("Scribe");
    expect(crewFor("pr-expert-quote-outreach", null, "PR quote").name).toBe("Quill");
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

const V2_FILES = [
  "src/components/v2/v2-shell.tsx",
  "src/components/v2/v2-client-layout.tsx",
  "src/components/v2/today-page.tsx",
  "src/components/v2/crew-page.tsx",
  "src/components/v2/missions-page.tsx",
  "src/components/v2/missions-table.tsx",
  "src/components/v2/mission-page.tsx",
  "src/components/v2/people-page.tsx",
  "src/components/v2/companies-page.tsx",
  "src/components/v2/deals-page.tsx",
  "src/components/v2/work-page.tsx",
  "src/components/v2/ui.tsx",
  "src/components/v2/company-page.tsx",
  "src/components/v2/records.tsx",
  "src/components/v2/runs.ts",
];

describe("v2 wiring", () => {
  it("the edge honours the choice only for a beta email, and keeps Clerk synced under /v2", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain("isBetaEmail(sessionClaims?.email)");
    expect(proxy).toContain('parseUiVersion(req.cookies.get(UI_VERSION_COOKIE)?.value) === "v2"');
    expect(proxy).toContain("v2PathForV1(pathname, req.nextUrl.search");
    expect(proxy).toContain('"/v2/orgs/:id"');
  });

  it("the v2 tree is gated on the beta allowlist and wears the beta badge", () => {
    const layout = read("src/components/v2/v2-client-layout.tsx");
    expect(layout).toContain("isBetaEmail(user?.primaryEmailAddress?.emailAddress)");
    expect(layout).toContain("This page is not available");
    expect(read("src/app/(authed)/v2/layout.tsx")).toContain("<V2ClientLayout>");
    // The sidebar's account menu carries the badge and the one way back to v1.
    const menus = read("src/components/v2/sidebar-menus.tsx");
    expect(menus).toContain('<MaturityBadge level="beta" />');
    expect(menus).toContain("Back to v1");
    expect(read("src/components/v2/v2-shell.tsx")).toContain("<AccountMenuV2 ");
  });

  it("the account menu follows Explee's user menu: Team, API Keys, Billing, Refer a friend, Help, Sign out", () => {
    const menus = read("src/components/v2/sidebar-menus.tsx");
    const order = ['label: "Team"', 'label: "API Keys"', 'label: "Billing"', 'label: "Refer a friend"', "Help\n", "Sign out"];
    const at = order.map((o) => menus.indexOf(o, menus.indexOf("export function AccountMenuV2")));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    // Help opens the same identified support chat the FAB opens.
    expect(menus).toContain("supportWhatsAppHref(email,");
    // Team is a v2 page on Clerk's own members, read-only.
    expect(read("src/components/v2/team-page.tsx")).toContain("useOrganization({ memberships:");
    // Staff join every org through god-mode: never list them as the customer's team.
    expect(read("src/components/v2/team-page.tsx")).toContain("!isAdminEmail(m.publicUserData?.identifier)");
  });

  it("the v1 sidebar offers the switch, beta-only and badged", () => {
    expect(read("src/components/context-sidebar.tsx")).toContain("<SwitchToV2 />");
    const sw = read("src/components/ui-version-switch.tsx");
    expect(sw).toContain("if (!isBeta) return null;");
    expect(sw).toContain('<MaturityBadge level="beta" />');
  });

  const V2_ROUTES = [
    "",
    "/crew",
    "/missions",
    "/missions/[campaignId]",
    "/missions/[campaignId]/settings",
    "/missions/[campaignId]/workflows",
    "/people",
    "/people/[leadRowId]",
    "/companies",
    "/deals",
    "/work",
    "/offers",
    "/offers/[offerId]",
    "/offers/[offerId]/targeting",
    "/targeting",
    "/integrations",
    "/integrations/merged",
    "/settings",
    "/billing",
    "/api-keys",
    "/account",
    "/team",
    "/referral",
  ];

  it("every sidebar section has a route", () => {
    for (const r of V2_ROUTES) {
      expect(existsSync(resolve(ROOT, `src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]${r}/page.tsx`)), r).toBe(true);
    }
  });

  it("reads v1's own query keys, so v2 and v1 share one cache", () => {
    const data = read("src/components/v2/data.ts");
    expect(data).toContain('["brandRevenue", brandId]');
    expect(data).toContain('["leadBucketCounts", brandLeadScopeKey(brandId), ""]');
    expect(data).toContain('["leadStandingCounts", brandLeadScopeKey(brandId), ""]');
    expect(read("src/components/v2/use-missions.ts")).toContain("useCampaignRows(brandId, featureSlug, ALL_OFFERS)");
    expect(read("src/components/v2/mission-hold.tsx")).toContain('["campaignHold", campaignId]');
  });

  it("the Deals board sizes each column from the producer's standing counts", () => {
    const deals = read("src/components/v2/deals-page.tsx");
    expect(deals).toContain("boardColumnTotals(useStandingCounts(brandId).data)");
    expect(deals).toContain("leadsColumnPageQuery({ column, search: \"\", shown })");
  });

  it("People pages and searches on the producer, never over loaded rows", () => {
    const people = read("src/components/v2/people-page.tsx");
    expect(people).toContain("offset: String(page * LEADS_PAGE_SIZE)");
    expect(people).toContain("leadsSearchProblem(search)");
    expect(people).not.toMatch(/\.filter\(\(l(ead)?\) =>/);
  });

  it("the v2 pages compute no ratio in the browser", () => {
    for (const f of V2_FILES) {
      const code = read(f);
      expect(code, f).not.toMatch(/Usd\s*\/\s*[a-zA-Z(]/);
      expect(code, f).not.toMatch(/Cents\s*\/\s*(?!100\b)[a-zA-Z(]/);
    }
  });

  it("no em-dash in v2 copy", () => {
    for (const f of V2_FILES) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      // "—" is allowed only as the absent-value marker in a `"—"` string literal.
      const stripped = code.replace(/"—"/g, "");
      expect(stripped, f).not.toContain("—");
    }
  });

  it("crew cards and Work read runs-service, filed under the crew, never counted from a lead list", () => {
    const runs = read("src/components/v2/runs.ts");
    expect(runs).toContain("getBrandRunsByCampaign(brandId, { startedAfter: start })");
    expect(runs).toContain("missionByCampaignId.get(g.campaignId)?.crew.key");
    expect(read("src/components/v2/crew-page.tsx")).toContain("useCrewRuns(brandId, missionByCampaignId)");
    expect(read("src/components/v2/work-page.tsx")).toContain("useRunsTodayList(brandId, 200)");
  });

  it("every company row opens its own record page", () => {
    expect(read("src/components/v2/companies-page.tsx")).toContain("companyHref(orgId, brandId, o)");
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/companies/[companyKey]/page.tsx")).toContain("<CompanyPage />");
  });
});

describe("v2 step 3: honest counts, green running, modals outside the bar", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

  it("needs-your-call is the positive-reply bucket inside the sales-interest standing", () => {
    const data = read("src/components/v2/data.ts");
    const body = data.slice(data.indexOf("export function useNeedsYourCall"), data.indexOf("export function useLatestInBucket"));
    expect(body).toContain('bucket: "positive_reply"');
    expect(body).toContain('standing: "sales_interest"');
  });

  it("no surface counts the sales_interest standing as people who want to talk", () => {
    for (const f of ["today-page.tsx", "work-page.tsx", "v2-shell.tsx"]) {
      const src = read(`src/components/v2/${f}`);
      expect(src).toContain("useNeedsYourCall(");
      expect(src).not.toMatch(/want(s)? to talk/);
      expect(src).not.toContain('column: "sales_interest"');
    }
    expect(read("src/components/v2/deals-page.tsx")).not.toContain("expected across");
  });

  it("the top bar carries no backdrop-filter (it would trap every fixed modal inside it)", () => {
    const ui = read("src/components/v2/ui.tsx");
    const bar = ui.slice(ui.indexOf("export function TopBar"), ui.indexOf("/** A Keel stat tile"));
    expect(bar).not.toContain("backdrop-blur");
  });

  it("every running indicator is green (--run), never the brand accent", () => {
    expect(read("src/components/v2/keel.css")).toMatch(/--run: #16a34a/);
    for (const f of ["ui.tsx", "v2-shell.tsx", "today-page.tsx", "work-page.tsx", "crew-page.tsx"]) {
      const src = read(`src/components/v2/${f}`);
      expect(src).not.toMatch(/k-dot-pulse[^"]*var\(--accent\)/);
    }
  });
});

describe("v2 Deals states who we contacted", () => {
  const src = read("src/components/v2/deals-page.tsx");
  it("names the in-play column Contacted and counts it in the heading", () => {
    expect(src).toContain('contacted: "Contacted"');
    expect(src).toContain("const contacted = totals?.contacted ?? null;");
    expect(src).toContain("{formatCount(contacted)}</span> contacted");
  });
});

describe("Keel parity, second pass", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
  const V2 = "src/components/v2/";

  it("every top bar carries the bell and the palette button, and the palette listens for it", () => {
    const ui = read(V2 + "ui.tsx");
    expect(ui).toContain("<TopBarUniversal />");
    expect(ui).toContain("useNeedsYourCall(brandId, 5)");
    expect(ui).toContain("OPEN_PALETTE_EVENT");
    expect(read(V2 + "sidebar-menus.tsx")).toContain("window.addEventListener(OPEN_PALETTE_EVENT, onOpen)");
  });

  it("key hints hide on a touch screen", () => {
    const ui = read(V2 + "ui.tsx");
    expect(ui.slice(ui.indexOf("export function KeyHint("))).toContain("k-keys");
  });

  it("the reply preview reads lead-service's merged history on the key the person page uses", () => {
    const data = read(V2 + "data.ts");
    expect(data).toContain('["leadHistory", leadRowId, brandId, "campaign"]');
    expect(read(V2 + "today-page.tsx")).toContain("useTheirLastWords(lead.id, brandId)");
    expect(read(V2 + "work-page.tsx")).toContain("useTheirLastWords(lead.id, brandId)");
  });

  it("Today states runs off runs-service and the meeting date off the served outcome", () => {
    const today = read(V2 + "today-page.tsx");
    expect(today).toContain("useCrewRuns(brandId, missionByCampaignId)");
    expect(today).toContain('useLatestInBucket(brandId, "meeting_booked", 3)');
    expect(today).toContain("outcomeByLeadId.get(lead.leadId)?.meetingBookedAt");
  });

  it("Crew runs table states how long each run took, off its own two instants", () => {
    const crew = read(V2 + "crew-page.tsx");
    expect(crew).toContain('"Took"');
    expect(crew).toContain("run.completedAt");
  });

  it("a Deals card's value is the organisation's served figure, looked up, never summed", () => {
    const deals = read(V2 + "deals-page.tsx");
    expect(deals).toContain("valueByDomain");
    expect(deals).not.toMatch(/reduce\(/);
  });
});
