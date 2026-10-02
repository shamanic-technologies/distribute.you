import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { stripV2Prefix, v2DashboardHref } from "../src/lib/ui-version";
import { crewFor, crewInitial, crewKey } from "../src/lib/v2/crews";
import { cumulativeWindow, dailyWindow, windowDays } from "../src/lib/v2/series";
import { brandIdFromPathname } from "../src/lib/brand-tint-preload";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("ui-version", () => {
  it("strips the v2 prefix so v1 parsers read a v2 URL", () => {
    expect(stripV2Prefix("/v2/orgs/o/brands/b")).toBe("/orgs/o/brands/b");
    expect(stripV2Prefix("/v2")).toBe("/");
    expect(stripV2Prefix("/orgs/o")).toBe("/orgs/o");
    expect(stripV2Prefix("/v2x/orgs")).toBe("/v2x/orgs");
    expect(v2DashboardHref("o", "b")).toBe("/v2/orgs/o/brands/b");
  });

  it("the tint parser reads the same brand under /v2", () => {
    expect(brandIdFromPathname("/v2/orgs/o/brands/b")).toBe("b");
    expect(brandIdFromPathname("/orgs/o/brands/b")).toBe("b");
    expect(brandIdFromPathname("/v2/orgs/o")).toBeNull();
  });
});

describe("crews", () => {
  it("takes the producer's crew name, and keeps our look per pair", () => {
    const scout = crewFor("sales-cold-email-outreach", "website_visit", "Cold email", "Scout");
    expect(scout.name).toBe("Scout");
    expect(scout.key).toBe(crewKey("sales-cold-email-outreach", "website_visit"));
    expect(scout.color).toBe("var(--data-teal)");
    expect(crewFor("ai-meeting-booking", "meeting_booked", "AI meeting booking", "Pilot").glyph).toBe("triangle");
  });

  it("names a crew the producer does not name by its channel, never an invented name", () => {
    expect(crewFor("some-new-channel", "website_visit", "Some channel").name).toBe("Some channel");
    expect(crewFor("sales-cold-email-outreach", "conversation", "Cold email", null).name).toBe("Cold email");
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
  "src/components/v2/offers-list.tsx",
  "src/components/v2/new-offer-modal.tsx",
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
  it("the edge sends every signed-in user's old v1 URL to v2, and keeps Clerk synced under /v2", () => {
    const proxy = read("src/proxy.ts");
    // v1 is deleted: no allowlist and no version cookie decide who lands on v2.
    expect(proxy).not.toContain("isBetaEmail(");
    expect(proxy).not.toContain("UI_VERSION_COOKIE");
    expect(proxy).toContain("v2PathForV1(pathname, req.nextUrl.search");
    expect(proxy).toContain('"/v2/orgs/:id"');
  });

  it("the v2 tree is GA: no allowlist gate, and a badge only on the named gated surfaces", () => {
    const layout = read("src/components/v2/v2-client-layout.tsx");
    expect(layout).not.toContain("isBetaEmail");
    expect(layout).not.toContain("This page is not available");
    expect(read("src/app/(authed)/v2/layout.tsx")).toContain("<V2ClientLayout>");
    // Staff surfaces (Workflows, Research, the cost and figure switches, the prompt Edit) sit
    // behind Staff mode (lib/use-staff-mode.ts) and carry NO tag (owner-decided 2026-09-29).
    // The only badges left in v2 are the generic tab-badge renderer in setup-pages and the
    // beta Integrations section of Brand settings (beta on the email allowlist).
    const GATED = new Set(["setup-pages.tsx", "brand-settings-page.tsx"]);
    for (const f of readdirSync(resolve(ROOT, "src/components/v2")).filter((n) => n.endsWith(".tsx"))) {
      if (GATED.has(f)) continue;
      expect(read(`src/components/v2/${f}`), f).not.toContain("MaturityBadge");
    }
    expect(read("src/components/v2/v2-shell.tsx")).not.toContain("isBeta");
    // v1 is deleted: the account menu offers no way back to it.
    const menus = read("src/components/v2/sidebar-menus.tsx");
    expect(menus).not.toContain("Back to v1");
    expect(read("src/components/v2/v2-shell.tsx")).toContain("<AccountMenuV2 ");
  });

  it("the account menu follows Explee's user menu: Team, API Keys, Billing, Refer a friend, Help, Sign out", () => {
    // Billing lives in this menu and ONLY here: the sidebar does not repeat it.
    expect(read("src/components/v2/v2-shell.tsx")).not.toContain('label="Billing"');
    const menus = read("src/components/v2/sidebar-menus.tsx");
    const order = ['label: "Team"', 'label: "API Keys"', 'label: "Billing"', 'label: "Refer a friend"', "Help\n", "Sign out"];
    const at = order.map((o) => menus.indexOf(o, menus.indexOf("export function AccountMenuV2")));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    // Help opens the same identified support chat the FAB opens.
    expect(menus).toContain("supportWhatsAppHref(email,");
    // Team is a v2 page on Clerk's own members; admins can invite (see org-invite.test.ts).
    expect(read("src/components/v2/team-page.tsx")).toContain("memberships: { pageSize: 50");
    // Staff join every org through god-mode: never list them as the customer's team.
    expect(read("src/components/v2/team-page.tsx")).toContain("!isAdminEmail(m.publicUserData?.identifier)");
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

describe("v2 Deals prices the contacted column off features-service", () => {
  const src = read("src/components/v2/deals-page.tsx");
  it("reads the served contacted value and computes none of it", () => {
    expect(src).toContain("getContactedValue(brandId, valueIds)");
    expect(src).toContain('["contactedValue", brandId, valueIds.join(",")]');
    expect(src).toContain("contactedValue.data?.totalExpectedValueUsd");
    expect(src).not.toMatch(/expectedValueUsd\s*\*/);
    expect(src).not.toMatch(/\.reduce\(/);
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

  it("Today states everything taken from the credit, setup included, off the figure billing debits", () => {
    // Hany Tawfik 2026-10-02: $29.66 used, Today printed the $20 of campaign spend and
    // the client read $10 still left. The tile reads the org total Billing's Usage reads.
    const today = read(V2 + "today-page.tsx");
    expect(read(V2 + "data.ts")).toContain('useAuthQuery(["orgUsage"], () => getOrgUsage()');
    expect(today).toContain("const usage = useOrgUsage();");
    expect(today).toContain('label="Taken from credit"');
    expect(today).toContain("formatUsdAdaptive(usage.data.totalBilledUsd)");
    expect(today).not.toContain("data.spend.totalSpentCents");
    // Missions keeps the campaign figure, labelled as such.
    expect(read(V2 + "missions-page.tsx")).toContain('label: "Spent on missions"');
  });

  it("Today states runs off runs-service and the meeting date off the served outcome", () => {
    const today = read(V2 + "today-page.tsx");
    expect(today).toContain("useCrewRuns(brandId, missionByCampaignId)");
    // Meetings are read wide and ordered on their booking date, newest first.
    expect(today).toContain('useLatestInBucket(brandId, "meeting_booked", MEETINGS_READ_LIMIT)');
    expect(today).toContain("outcomeByLeadId.get(lead.leadId)?.meetingBookedAt");
    expect(today).toContain('.sort((a, b) => (meetingAt(b) ?? "").localeCompare(meetingAt(a) ?? ""))');
    expect(today).toContain(".slice(0, MEETINGS_SHOWN)");
  });

  it("Crew runs table states how long each run took, off its own two instants", () => {
    const crew = read(V2 + "crew-page.tsx");
    expect(crew).toContain('"Took"');
    expect(crew).toContain("run.completedAt");
  });

  it("Deals column and card values are features-service's deals-value, read, never summed", () => {
    const deals = read(V2 + "deals-page.tsx");
    expect(deals).toContain('["dealsValue", brandId]');
    expect(deals).toContain("served.byLead.get(lead.leadId)");
    expect(deals).not.toContain("valueByDomain");
    expect(deals).not.toMatch(/reduce\(/);
  });

  it("Crew success rate and median run are runs-service's run-outcomes, one crew family per request", () => {
    const runs = read(V2 + "runs.ts");
    expect(runs).toContain('groupBy: "featureSlug", campaignIds: ids');
    const crew = read(V2 + "crew-page.tsx");
    expect(crew).toContain("outcomes?.month?.successRate");
    expect(crew).toContain("outcomes?.today?.medianDurationMs");
    expect(crew).not.toMatch(/completedCount\s*\//);
  });
});

describe("v2 sidebar Deals badge agrees with the Deals board", () => {
  it("counts the in-play board columns off the same column totals the page reads", () => {
    const shell = read("src/components/v2/v2-shell.tsx");
    expect(shell).toContain("boardColumnTotals(standings)");
    expect(shell).toContain("boardTotals.contacted + boardTotals.sales_interest + boardTotals.won");
    expect(shell).toContain("trailing={<Count n={dealsInPlay} />}");
    expect(shell).not.toContain("standings.counts.sales_interest + standings.counts.customer");
  });
});

describe("sending block (features-service outcomes.sending)", () => {
  it("parses the brand's sending block and keeps a missing one null", async () => {
    const { RevenueSendingSchema } = await import("../src/lib/revenue-parse");
    const body = {
      recipientsSent: 250, recipientsDelivered: 240, recipientsBounced: 6, recipientsAwaitingDelivery: 4,
      recipientsReplied: 3, recipientsRepliedPositive: 1,
      deliveryRatePct: 96, bounceRatePct: 2.4, replyRatePct: 1.2, positiveReplyRatePct: 0.4,
    };
    expect(RevenueSendingSchema.parse(body).deliveryRatePct).toBe(96);
    expect(RevenueSendingSchema.parse({ ...body, recipientsSent: 0, deliveryRatePct: null }).deliveryRatePct).toBeNull();
  });

  it("the v2 surfaces print the served rates and divide nothing", () => {
    const page = read("src/components/v2/missions-page.tsx");
    expect(page).toContain("data.sending.deliveryRatePct");
    expect(page).toContain("recipientsBounced");
    const table = read("src/components/v2/missions-table.tsx");
    expect(table).toContain("g?.sentCount");
    expect(table).toContain("g?.replyRatePct");
    expect(read("src/lib/api.ts")).toContain("replyRatePct: g.outcomes?.sending?.replyRatePct");
  });
});
