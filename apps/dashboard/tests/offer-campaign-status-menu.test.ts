import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The Campaigns table sits in `k-card overflow-hidden` + `k-scroll overflow-x-auto`, which
// clipped the On/Off menu when it was `absolute` inside the row: it read as opening under
// the page. The menu is portalled to #v2-portal and placed `fixed` against its button.
const src = readFileSync(join(__dirname, "../src/components/v2/offer-campaigns.tsx"), "utf8");
const status = src.slice(src.indexOf("function CampaignStatus("), src.indexOf("function budgetLabel("));

describe("offer Campaigns On/Off menu", () => {
  it("is portalled out of the clipping table card", () => {
    expect(status).toContain("createPortal(");
    expect(status).toContain('document.getElementById("v2-portal")');
    expect(status).toContain('className="k-popover fixed z-50');
    expect(status).not.toContain("absolute right-0 top-full");
  });

  it("an outside click ignores clicks inside the portalled menu", () => {
    expect(status).toContain("!menuRef.current?.contains(t)");
  });

  it("closes on scroll (a fixed menu would drift off its button)", () => {
    expect(status).toContain('document.addEventListener("scroll", dismiss');
  });
});
