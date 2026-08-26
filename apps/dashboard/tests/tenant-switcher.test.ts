import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Sidebar-top tenant switcher (GA — the only dashboard chrome).
 *
 * The top bar carries no product mark, no wordmark and no breadcrumb; the org →
 * brand hierarchy and org-scoped Billing live in ONE menu anchored at the top of
 * the sidebar, level with the header row.
 *
 * Source-substring guards (the dashboard convention — these modules import through
 * the `@` alias, which vitest does not resolve in this repo).
 */
describe("Tenant switcher", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const switcher = read("src/components/tenant-switcher.tsx");
  const header = read("src/components/header.tsx");
  const sidebar = read("src/components/context-sidebar.tsx");
  const layout = read("src/app/(authed)/(dashboard)/layout.tsx");
  const hook = read("src/lib/use-tenant-switcher.ts");

  it("ships to everyone — no chrome branch is left gated behind an allowlist", () => {
    // GA: the pre-switcher chrome is deleted, not gated off. A surviving
    // `useIsBetaUser` in the sidebar or the shell would mean a second chrome
    // path is still alive and can rot unnoticed.
    for (const [name, src] of [
      ["context-sidebar", sidebar],
      ["layout", layout],
    ] as const) {
      expect(src, `${name} must not gate the chrome`).not.toContain("useIsBetaUser");
    }
    // The header still reads `useIsBetaUser`, but ONLY for the unrelated beta
    // Profile entry in the account menu — never to branch the chrome.
    expect(header).not.toContain("!isBeta");
    expect(header).toContain("/account");
  });

  it("header carries no product mark, no wordmark and no breadcrumb", () => {
    expect(header).toContain("<MobileTenantChip />");
    expect(header).not.toContain("logo-distribute.svg");
    expect(header).not.toContain("BreadcrumbNav");
    // The dead `minimal` prop went with the logo it was the last user of.
    expect(header).not.toContain("minimal");
  });

  it("breadcrumb-nav survives for the onboarding chrome", () => {
    // It is no longer mounted in the dashboard, but `onboarding-top-chrome`
    // still renders it (guarded by onboarding-escape-chrome.test.ts).
    expect(read("src/components/onboarding/onboarding-top-chrome.tsx")).toContain(
      "BreadcrumbNav",
    );
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

  it("the panel carries org, brand and org-scoped settings", () => {
    expect(switcher).toContain("New organization");
    expect(switcher).toContain("New brand");
    // The entry names the whole org group it opens (Billing AND API Key), not
    // just Billing — a label narrower than its destination reads as a gap.
    expect(switcher).toContain("<span>Organization Settings</span>");
    expect(switcher).not.toContain("<span>Billing</span>");
    // The href is unchanged: every deep link in the app points at /billing.
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

  it("carries THREE tiers — org, brand, offer — and opens one at a time", () => {
    // The switcher used to cap at two tiers, on Carbon / GitLab Pajamas guidance.
    // It carries three now, deliberately: the OFFER is a real level of the product
    // (a brand is an identity, an offer is a proposition, and campaigns, audiences
    // and leads all belong to the offer), so leaving it out would mean there is no
    // way to change proposition from the chrome at all.
    expect(switcher).toContain('useState<"org" | "brand" | "offer" | null>');
    expect(switcher).toContain("Switch offer");
    expect(switcher).toContain("t.handleOfferSwitch(o.offerId)");
    // What that guidance protects against is several open panels stacking into a
    // maze, and that still cannot happen: ONE tier is expanded at a time, so no
    // more than two panels are ever on screen, exactly as with two tiers.
    expect(switcher).toContain("setExpanded((prev) => (prev === key ? null : key))");
    // A FOURTH tier is not here — a campaign is picked from its offer's own table,
    // with the numbers beside it.
    expect(switcher).not.toContain('"campaign"');
  });

  it("never asserts an offer name it does not have", () => {
    // Same rule as the org and brand tiers: an unknown tenant renders a skeleton,
    // never a fabricated label beside a generic mark.
    expect(switcher).toContain("t.offerId && !t.offerKnown ?");
    expect(hook).toContain("const offerKnown = !!displayOffer");
  });

  it("draws the hierarchy with a 1px connector rail, not a bare indent", () => {
    // A colored side-border accent thicker than 1px is banned repo-wide; this is
    // a 1px neutral rail plus the disclosure chevron.
    expect(switcher).toContain("w-px bg-gray-200");
    expect(switcher).toContain("h-px w-2.5 bg-gray-200");
  });

  it("no longer labels itself beta", () => {
    expect(switcher).not.toContain("MaturityBadge");
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

  it("the shell is L-shaped: sidebar column beside the header column", () => {
    expect(layout).toContain('<div className="h-screen flex bg-gray-50 overflow-hidden">');
    expect(layout).toContain('<div className="flex min-w-0 flex-1 flex-col overflow-hidden">');
    // The old full-width-header-on-top shell is deleted, not branched around.
    expect(layout).not.toContain('"h-screen flex flex-col bg-gray-50 overflow-hidden"');
  });

  it("there is no org nav level, and Billing keeps its own URL", () => {
    // Billing keeps its route — billing-guard, credit-alerts and onboarding
    // deep-link to it, so moving it would be pure link rot.
    expect(sidebar).toContain("`/orgs/${orgId}/billing`");
    // The org "Overview" item was only a brand picker; the switcher is the brand
    // picker now, so the whole org nav level is gone.
    const orgLevel = sidebar.slice(
      sidebar.indexOf("function OrgLevelSidebar"),
      sidebar.indexOf("function BrandLevelSidebar"),
    );
    expect(orgLevel).not.toContain('label: "Overview"');
    expect(orgLevel).toContain("<SidebarSection topSlot={<TenantSwitcher />}>");
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
