import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * During onboarding auto-create (URL carries the autoCreate query param), the brands
 * page shows a full-screen "Setting up your brand..." loader. The dashboard layout must
 * NOT paint the navigable chrome (sidebar, header breadcrumb, logo link, hamburger) in
 * that window — clicking it races the async brand-create + redirect and bugs out. So the
 * layout hides the sidebar and renders the Header in `minimal` mode (brand mark + user
 * menu only). The user-menu / sign-out stays as an escape hatch.
 */
describe("Onboarding setup loader hides the navigable chrome", () => {
  const layoutPath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/layout.tsx"
  );
  const layout = fs.readFileSync(layoutPath, "utf-8");

  const headerPath = path.join(__dirname, "../src/components/header.tsx");
  const header = fs.readFileSync(headerPath, "utf-8");

  it("layout reads the autoCreate onboarding signal from searchParams", () => {
    expect(layout).toContain("useSearchParams");
    expect(layout).toContain('searchParams.get("autoCreate")');
  });

  it("layout computes an onboarding-setup flag", () => {
    expect(layout).toContain("isOnboardingSetup");
  });

  it("layout gates the sidebar render on NOT being in onboarding setup", () => {
    // The desktop sidebar wrapper must sit behind the onboarding-setup guard.
    expect(layout).toMatch(
      /!isOnboardingSetup && \(\s*<div className="hidden md:flex/
    );
    // Two guarded ContextSidebar render paths remain (mobile drawer + desktop).
    expect(layout.match(/!isOnboardingSetup && \(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("layout passes minimal mode to the Header during onboarding setup", () => {
    expect(layout).toContain("<Header minimal={isOnboardingSetup}");
  });

  it("header accepts a minimal prop", () => {
    expect(header).toMatch(/function Header\(\{\s*minimal/);
  });

  it("header gates the breadcrumb nav on NOT minimal", () => {
    expect(header).toMatch(/!minimal/);
    expect(header).toContain("BreadcrumbNav");
  });

  it("does not regress the monotonic body-flash gate", () => {
    // The onboarding-no-dashboard-flash regression invariants must survive this change.
    expect(layout).toMatch(/showContent\s*\?\s*children/);
    expect(layout).toContain("hasResolvedOnce");
  });
});
