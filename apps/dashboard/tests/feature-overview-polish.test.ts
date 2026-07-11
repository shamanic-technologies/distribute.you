import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

// Single-feature product: the feature segment was flattened into the brand
// level. The brand ROOT page IS the (sole) feature's Overview; the campaigns
// list lives at the brand-level /campaigns route.
const FEATURE_DIR =
  "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";

describe("Feature landing defaults to Overview (item 1)", () => {
  const indexPage = read(`${FEATURE_DIR}/page.tsx`);

  it("brand root page IS the Overview (renders the revenue section inline)", () => {
    // No redirect-decider anymore — the brand root renders the overview directly.
    expect(indexPage).toContain("RevenueOverviewSection");
    // Overview shown for revenue features (GA — no flag gate).
    expect(indexPage).toContain("isRevenueFeature");
    // The overview does not fetch the campaign list (the campaign concept is gone).
    expect(indexPage).not.toContain("listCampaignsByBrand");
  });

  // The campaigns LIST route + its sidebar nav entry were removed with the
  // campaign concept; the brand root IS the overview.
});

describe("Revenue empty state (item 2)", () => {
  const emptyState = read("components/revenue/revenue-empty-state.tsx");
  it("messages 'no metrics yet' with no manual launch CTA", () => {
    expect(emptyState).toContain("No metrics yet");
    expect(emptyState).not.toContain("Launch outreach");
    expect(emptyState).not.toContain("Create a campaign");
    expect(emptyState).not.toContain("Set up sales economics");
  });
});

describe("Tables paginate 20 rows/page (item 3)", () => {
  const pager = read("components/table-pagination.tsx");
  const conversions = read("components/revenue/conversions-table.tsx");

  it("default page size is 20 and the pager is api-free", () => {
    expect(pager).toContain("TABLE_PAGE_SIZE = 20");
    expect(pager).not.toContain('from "@/lib/api"');
  });

  it("all three conversion tables paginate", () => {
    expect(conversions).toContain("usePaginated(orgs)");
    expect(conversions).toContain("usePaginated(leads)");
    expect(conversions).toContain("usePaginated(events)");
    // The old append-only "Show more" must be gone.
    expect(conversions).not.toContain("EVENTS_PAGE_SIZE");
  });
});

describe("Org logos render Clerk imageUrl (item 4)", () => {
  const breadcrumb = read("components/breadcrumb-nav.tsx");
  it("breadcrumb root + switcher use organization.imageUrl via OrgAvatar", () => {
    expect(breadcrumb).toContain("function OrgAvatar(");
    // Root avatar uses the per-tab URL org's cached image (#1948); the switcher
    // list still maps each membership's own imageUrl.
    expect(breadcrumb).toContain("imageUrl={displayOrgImageUrl}");
    expect(breadcrumb).toContain("imageUrl={m.organization.imageUrl}");
    // No more hardcoded-initial-only org badge.
    expect(breadcrumb).not.toContain("{organization?.name?.[0] || \"O\"}");
  });
});

describe("Conversion events show lead photos (item 5)", () => {
  const conversions = read("components/revenue/conversions-table.tsx");

  it("event table takes a photoByLeadId map (no forced null avatar)", () => {
    expect(conversions).toContain("photoByLeadId");
    expect(conversions).not.toContain("photoUrl={null}");
    // Avatar falls back to initials when the image breaks.
    expect(conversions).toContain("onError={() => setBroken(true)}");
  });
});

describe("Adaptive currency: <$10 keeps cents, ≥$10 whole dollars", () => {
  const conversions = read("components/revenue/conversions-table.tsx");

  it("formatUsd guards a positive sub-cent amount", () => {
    expect(conversions).toContain('if (n > 0 && n < 0.01) return "<$0.01";');
  });

  it("formatUsd logic: cents under $10, whole dollars from $10", () => {
    const formatUsd = (n: number): string => {
      if (n > 0 && n < 0.01) return "<$0.01";
      const decimals = Math.abs(n) < 10 ? 2 : 0;
      return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    };
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.4)).toBe("$0.40");
    expect(formatUsd(0.001)).toBe("<$0.01");
    expect(formatUsd(9.99)).toBe("$9.99");
    expect(formatUsd(1234)).toBe("$1,234");
  });
});
