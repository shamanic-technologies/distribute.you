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
  });

  it("the mobile chip opens the FULL menu itself, not the drawer", () => {
    // Routing through the drawer would cost two taps and drop a right-hand
    // flyout inside a 224px panel. The chip anchors the same menu under the
    // header instead, and it must not reach for the drawer toggle.
    const chip = switcher.slice(switcher.indexOf("export function MobileTenantChip"));
    expect(chip).toContain("<TenantMenu");
    expect(chip).not.toContain("useMobileSidebar");
    // Bounded to the viewport so a long org list can't run off a short screen.
    expect(chip).toContain("overflow-y-auto");
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

  it("opens each submenu to the RIGHT of the panel on desktop, stacked on mobile", () => {
    // Atlassian's app switcher is the canonical two-level-in-one-menu shape and
    // it is side-by-side, not nested. Below `md` a flyout would run off-screen
    // (the sidebar is 224px and becomes a drawer), so it stacks instead.
    const submenu = switcher.slice(
      switcher.indexOf("function Submenu("),
      switcher.indexOf("function TenantMenu("),
    );
    expect(submenu).toContain("md:absolute");
    expect(submenu).toContain("md:left-full");
    expect(submenu).toContain("md:top-0");
    // Stacked by default = no UNPREFIXED absolute positioning. (`\b` alone would
    // match inside `md:absolute`, since `:` is not a word character.)
    expect(submenu).not.toMatch(/(?:^|[\s"])absolute[\s"]/);
  });

  it("never opens more than one submenu, so a third tier stays impossible", () => {
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

  it("sits flush at the top of the sidebar, exactly level with the header row", () => {
    // The two rows sit SIDE BY SIDE in the L-shaped shell, so they must be the
    // same height by construction — one shared token, never a hand-tuned pixel
    // value (the first attempt hardcoded a miscounted `h-[49px]` against a header
    // that actually renders ~57px, and the seam showed).
    const chromeRow = read("src/lib/chrome-row.ts");
    expect(chromeRow).toContain("export const CHROME_ROW_HEIGHT");
    for (const [name, src] of [["switcher", switcher], ["header", header]] as const) {
      expect(src, `${name} must derive its row height from the shared token`).toContain(
        "CHROME_ROW_HEIGHT",
      );
    }
    expect(switcher).not.toContain("h-[49px]");
    // Same border colour on both so the edge reads as one continuous line — and
    // on the WRAPPER, never on the sized element (border-box would otherwise
    // shave 1px off the switcher and re-open the seam).
    expect(switcher).toContain('className="relative border-b border-gray-200"');
    expect(header).toContain("border-b border-gray-200");
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
