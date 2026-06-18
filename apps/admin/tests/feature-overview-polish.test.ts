import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

const FEATURE_DIR =
  "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]";

describe("Feature landing defaults to Overview (item 1)", () => {
  const indexPage = read(`${FEATURE_DIR}/page.tsx`);
  const campaignsPage = read(`${FEATURE_DIR}/campaigns/page.tsx`);
  const sidebar = read("components/context-sidebar.tsx");

  it("bare feature page is a redirect decider, not the campaigns list", () => {
    expect(indexPage).toContain("router.replace");
    expect(indexPage).toContain("/overview");
    expect(indexPage).toContain("/campaigns");
    // Overview shown for revenue features (GA — no flag gate).
    expect(indexPage).toContain("isRevenueFeature");
    // The campaigns list must NOT live in the bare page anymore.
    expect(indexPage).not.toContain("listCampaignsByBrand");
  });

  it("campaigns list moved to /campaigns route", () => {
    expect(campaignsPage).toContain("listCampaignsByBrand");
    expect(campaignsPage).toContain("New Campaign");
  });

  it("sidebar Campaigns nav points at the /campaigns route", () => {
    expect(sidebar).toContain(
      '{ id: "campaigns", label: "Campaigns", href: `${basePath}/campaigns`, icon: <EnvelopeIcon /> },',
    );
  });
});

describe("Revenue empty state reframed to campaign-first (item 2)", () => {
  const emptyState = read("components/revenue/revenue-empty-state.tsx");
  it("messages 'no metrics yet, launch a campaign' with explicit button", () => {
    expect(emptyState).toContain("No metrics yet");
    expect(emptyState).toContain("Create a campaign");
    expect(emptyState).not.toContain("Set up sales economics");
  });
});

describe("Tables paginate 20 rows/page (item 3)", () => {
  const pager = read("components/table-pagination.tsx");
  const conversions = read("components/revenue/conversions-table.tsx");
  const publicLeads = read("components/report/public-leads-view.tsx");

  it("default page size is 20 and the pager is api-free", () => {
    expect(pager).toContain("TABLE_PAGE_SIZE = 20");
    expect(pager).not.toContain('from "@/lib/api"');
  });

  it("all three conversion tables + public leads view paginate", () => {
    expect(conversions).toContain("usePaginated(orgs)");
    expect(conversions).toContain("usePaginated(leads)");
    expect(conversions).toContain("usePaginated(events)");
    // The old append-only "Show more" must be gone.
    expect(conversions).not.toContain("EVENTS_PAGE_SIZE");
    expect(publicLeads).toContain("usePaginated(filteredLeads)");
  });
});

describe("Org logos render Clerk imageUrl (item 4)", () => {
  const breadcrumb = read("components/breadcrumb-nav.tsx");
  it("breadcrumb root + switcher use organization.imageUrl via OrgAvatar", () => {
    expect(breadcrumb).toContain("function OrgAvatar(");
    expect(breadcrumb).toContain("imageUrl={organization?.imageUrl}");
    // Switcher lists all platform orgs (admin god-mode) via OrgAvatar with the
    // org's Clerk imageUrl — `o` is the per-org row from /api/admin/orgs.
    expect(breadcrumb).toContain("imageUrl={o.imageUrl}");
    // No more hardcoded-initial-only org badge.
    expect(breadcrumb).not.toContain("{organization?.name?.[0] || \"O\"}");
  });
});

describe("Conversion events show lead photos (item 5)", () => {
  const conversions = read("components/revenue/conversions-table.tsx");
  const conversionsPage = read(`${FEATURE_DIR}/conversions/page.tsx`);
  const reportRevenue = read("components/report/revenue-view.tsx");

  it("event table takes a photoByLeadId map (no forced null avatar)", () => {
    expect(conversions).toContain("photoByLeadId");
    expect(conversions).not.toContain("photoUrl={null}");
    // Avatar falls back to initials when the image breaks.
    expect(conversions).toContain("onError={() => setBroken(true)}");
  });

  it("the Events tab/section is removed from the conversions page + public report", () => {
    expect(conversionsPage).not.toContain("EventConversionsTable");
    expect(reportRevenue).not.toContain("EventConversionsTable");
  });
});

describe("Sub-dollar expected revenue shows <$1 (item 7)", () => {
  const conversions = read("components/revenue/conversions-table.tsx");

  it("formatUsd guards a positive amount that rounds to $0", () => {
    expect(conversions).toContain('if (n > 0 && Math.round(n) === 0) return "<$1";');
  });

  it("formatUsd logic: <$1 for sub-dollar, $0 for true zero", () => {
    const formatUsd = (n: number): string => {
      if (n > 0 && Math.round(n) === 0) return "<$1";
      return `$${Math.round(n).toLocaleString("en-US")}`;
    };
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(0.4)).toBe("<$1");
    expect(formatUsd(0.01)).toBe("<$1");
    expect(formatUsd(0.6)).toBe("$1");
    expect(formatUsd(1234)).toBe("$1,234");
  });
});
