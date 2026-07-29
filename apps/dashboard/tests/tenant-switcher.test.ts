import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Beta chrome: sidebar-top tenant switcher.
 *
 * The top bar loses the product mark, the wordmark and the breadcrumb; the org →
 * brand hierarchy and org-scoped Billing move into ONE menu anchored at the top
 * of the sidebar, level with the header row.
 *
 * Source-substring guards (the dashboard convention — these modules import through
 * the `@` alias, which vitest does not resolve in this repo).
 */
describe("Tenant switcher (beta chrome)", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const switcher = read("src/components/tenant-switcher.tsx");
  const header = read("src/components/header.tsx");
  const sidebar = read("src/components/context-sidebar.tsx");
  const layout = read("src/app/(authed)/(dashboard)/layout.tsx");
  const hook = read("src/lib/use-tenant-switcher.ts");

  it("is gated on the beta allowlist on every surface it touches", () => {
    for (const [name, src] of [
      ["header", header],
      ["context-sidebar", sidebar],
      ["layout", layout],
    ] as const) {
      expect(src, `${name} must gate the new chrome on useIsBetaUser`).toContain(
        "useIsBetaUser",
      );
    }
  });

  it("header drops the logo, the wordmark and the breadcrumb for beta users", () => {
    // The beta branch renders the mobile tenant chip instead of the brand mark,
    // and the breadcrumb is gated off.
    expect(header).toContain("isBeta && !minimal ? (");
    expect(header).toContain("<MobileTenantChip />");
    expect(header).toContain("{!minimal && !isBeta && (");
  });

  it("header keeps the pre-beta chrome intact for everyone else", () => {
    // Non-beta users must still get the logo link + wordmark + breadcrumb.
    expect(header).toContain('src="/logo-distribute.svg"');
    expect(header).toContain("distribute.you");
    expect(header).toContain("<BreadcrumbNav />");
  });

  it("mobile keeps a tenant identity in the bar (the sidebar is a drawer there)", () => {
    expect(switcher).toContain("export function MobileTenantChip");
    expect(switcher).toContain("md:hidden");
    expect(switcher).toContain("useMobileSidebar");
  });

  it("the panel carries org, brand and org-scoped Billing", () => {
    expect(switcher).toContain("New organization");
    expect(switcher).toContain("New brand");
    expect(switcher).toContain("Billing");
    expect(switcher).toContain("`/orgs/${t.orgId}/billing`");
    // Create entries route into the real onboarding flow, never a stripped modal.
    expect(switcher).toContain('"/onboarding?new=1&from=add"');
    expect(switcher).toContain('"/onboarding?from=add"');
  });

  it("expresses org → brand as an accordion, never a third tier", () => {
    // One section open at a time — a two-tier dropdown is what NN/g warns about,
    // and Carbon / GitLab Pajamas both cap a left panel at two tiers.
    expect(switcher).toContain('useState<"org" | "brand" | null>');
    expect(switcher).toContain("setExpanded((prev) => (prev === key ? null : key))");
  });

  it("draws the hierarchy with a 1px connector rail, not a bare indent", () => {
    // A colored side-border accent thicker than 1px is banned repo-wide; this is
    // a 1px neutral rail plus the disclosure chevron.
    expect(switcher).toContain("w-px bg-gray-200");
    expect(switcher).toContain("h-px w-2.5 bg-gray-200");
  });

  it("labels itself beta inside the panel", () => {
    expect(switcher).toContain('<MaturityBadge level="beta" />');
  });

  it("sits flush at the top of the sidebar, level with the header row", () => {
    // The header is a 28px row inside py-2.5 + a 1px border → 49px. The switcher
    // block matches it so the two read as one continuous band.
    expect(switcher).toContain("h-[49px]");
    expect(sidebar).toContain("topSlot");
    expect(sidebar).toContain("{topSlot}");
    expect(sidebar).toContain("<TenantSwitcher />");
  });

  it("beta shell is L-shaped: sidebar column beside the header column", () => {
    expect(layout).toContain("if (isBeta) {");
    expect(layout).toContain('<div className="h-screen flex bg-gray-50 overflow-hidden">');
    expect(layout).toContain('<div className="flex min-w-0 flex-1 flex-col overflow-hidden">');
  });

  it("beta drops the org nav level but keeps Billing on its own URL", () => {
    expect(sidebar).toContain("function OrgSettingsLevelSidebar");
    expect(sidebar).toContain("if (isBeta) return <OrgSettingsLevelSidebar");
    // Billing keeps its route — billing-guard, credit-alerts and onboarding
    // deep-link to it, so moving it would be pure link rot.
    expect(sidebar).toContain("`/orgs/${orgId}/billing`");
    // The org "Overview" item (a brand picker) is gone from the beta surface —
    // the tenant switcher is the brand picker now.
    const orgSettings = sidebar.slice(
      sidebar.indexOf("function OrgSettingsLevelSidebar"),
      sidebar.indexOf("// Org Level Sidebar"),
    );
    expect(orgSettings).not.toContain('label: "Overview"');
  });

  it("both tenant surfaces share ONE switch implementation", () => {
    expect(hook).toContain("export function useTenantSwitcher");
    expect(read("src/components/breadcrumb-nav.tsx")).toContain("useTenantSwitcher()");
    expect(switcher).toContain("useTenantSwitcher()");
    // God-mode (staff all-orgs list + join-then-setActive) survives the move.
    expect(hook).toContain("isAdminEmail");
    expect(hook).toContain("/api/admin/orgs/${clerkOrgId}/join");
    expect(switcher).toContain("t.isStaff");
  });
});
