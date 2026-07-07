import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Escape-hatch chrome for an EXISTING user entering onboarding via ?from=add /
// ?new=1: the breadcrumb org→brand switcher + logo + Cancel let them return to a
// live tenant mid-flow, while first-run signup stays a focused, no-escape setup.
// (Multitenant onboarding UX — Vercel/Linear/Stripe keep the switcher + exit
// visible during a create flow.)

describe("Onboarding escape chrome", () => {
  const chrome = fs.readFileSync(
    path.join(__dirname, "../src/components/onboarding/onboarding-top-chrome.tsx"),
    "utf-8",
  );
  const layout = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/onboarding/layout.tsx"),
    "utf-8",
  );

  it("detects the add/new flow from the entry params", () => {
    expect(chrome).toContain("useSearchParams");
    expect(chrome).toContain('params.get("from") === "add"');
    expect(chrome).toContain('params.get("new") === "1"');
  });

  it("first-run signup keeps the focused, no-escape account widget only", () => {
    // The non-add branch renders the account widget and NOTHING else — no
    // breadcrumb, no logo link, no Cancel. The trap is intentional (DIS-111).
    // The widget is a slim IN-FLOW top bar (shrink-0, right-aligned), NOT a
    // floating `fixed` corner overlay — the overlay read as a stray orphan.
    expect(chrome).toContain("if (!isAddFlow)");
    expect(chrome).toContain("flex shrink-0 justify-end");
    expect(chrome).toContain("OnboardingAccountWidget");
    // No floating overlay on the first-run widget.
    expect(chrome).not.toContain("fixed top-4 right-4");
  });

  it("add/new flow mounts the org→brand switcher + a logo + a Cancel exit", () => {
    expect(chrome).toContain("BreadcrumbNav");
    // Both the logo and Cancel point at the dashboard (resolves to last-visited
    // brand via the last-brand cookie at the edge).
    expect(chrome).toContain("explicitHierarchyHref");
    expect(chrome).toContain("Cancel");
  });

  it("layout mounts the chrome and keeps the responsive content shell", () => {
    expect(layout).toContain("OnboardingTopChrome");
    // The centered content shell (and its responsive classes asserted by
    // onboarding-responsive.test.ts) must stay in the layout, not move into chrome.
    expect(layout).toContain("min-h-[100svh]");
    expect(layout).toContain("flex w-full min-w-0 max-w-5xl flex-1 flex-col sm:flex-none");
  });
});
