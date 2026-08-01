import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * `InfoTooltip` is the dashboard's only (i) primitive, and it was unusable on a
 * phone at every one of its call sites.
 *
 * A touch tap emits `pointerdown → touchend → mouseenter → click`: the
 * compatibility mouse events fire BEFORE the click. The old trigger opened on a
 * bare `onMouseEnter` and toggled on `onClick`, so a tap opened the bubble and then
 * immediately shut it — it flashed and vanished, on billing, audiences, strategy,
 * the sidebar and the revenue cards alike. #2026 set out to make these
 * tap-accessible; this event ordering is what defeated it.
 *
 * Two structural constraints came with the fix: the trigger cannot be a `<button>`
 * (it renders inside the budget-tier `<button>`s, and a nested button is invalid
 * HTML), and a 14px icon is below WCAG 2.2 SC 2.5.8's 24x24 minimum touch target.
 *
 * Source-substring guards: the component is a client component pulling `@`-aliased
 * imports, matching the repo's other page guards.
 */
describe("InfoTooltip — usable with a thumb", () => {
  const root = path.join(__dirname, "..");
  const src = fs.readFileSync(
    path.join(root, "src/components/visibility/metric-info.tsx"),
    "utf-8",
  );

  it("opens on hover ONLY for a mouse, so a tap is not toggled shut by its own mouseenter", () => {
    expect(src).toContain('if (e.pointerType === "mouse") setOpen(true)');
    expect(src).toContain('if (e.pointerType === "mouse") setOpen(false)');
    // The unguarded handlers are what caused the flash.
    expect(src).not.toContain("onMouseEnter={() => setOpen(true)}");
    expect(src).not.toContain("onMouseLeave={() => setOpen(false)}");
  });

  it("uses a span trigger so it stays valid inside a clickable card", () => {
    // `lastIndexOf`: the doc comment above the component also names `role="button"`.
    const at = src.lastIndexOf('role="button"');
    expect(at).toBeGreaterThan(-1);
    const trigger = src.slice(at, at + 900);
    expect(trigger).toContain("tabIndex={0}");
    expect(trigger).toContain("aria-expanded={open}");
    // Enter/Space keep a non-button trigger operable from the keyboard.
    expect(trigger).toContain('e.key !== "Enter" && e.key !== " "');
    // A <button> here nests inside the budget-tier buttons and breaks the card.
    expect(src).not.toContain('<button\n        type="button"');
  });

  it("pads the hit area to the 24px minimum while the icon stays 14px", () => {
    expect(src).toContain("-m-1.5 inline-flex cursor-help p-1.5");
    expect(src).toContain('<InformationCircleIcon className="w-3.5 h-3.5 text-gray-400" />');
  });

  it("stops propagation so tapping the icon does not also pick the card it sits in", () => {
    const click = src.slice(src.indexOf("onClick={(e) => {"), src.indexOf("onClick={(e) => {") + 400);
    expect(click).toContain("e.stopPropagation()");
  });

  it("leaves no native-title info tip behind on the surfaces it replaced", () => {
    // Each of these shipped an InformationCircleIcon + `title=` + `cursor-help`,
    // i.e. an (i) that showed nothing at all on a touch device.
    const migrated = [
      "src/components/audiences/engaged-leads-page.tsx",
      "src/components/brand/brand-status-control.tsx",
      "src/components/onboarding/onboarding.tsx",
      "src/components/strategy/best-model-card.tsx",
      "src/components/settings/brand-sales-funnels-card.tsx",
      "src/components/strategy/strategy-page.tsx",
    ];
    for (const rel of migrated) {
      const body = fs.readFileSync(path.join(root, rel), "utf-8");
      expect(body, `${rel} should import the shared primitive`).toContain(
        'from "@/components/visibility/metric-info"',
      );
      // `cursor-help` was the tell of a hand-rolled native-title tip; the primitive
      // owns that class now, so no call site should still carry it.
      expect(body, `${rel} still hand-rolls a native-title tip`).not.toContain("cursor-help");
    }
  });
});
