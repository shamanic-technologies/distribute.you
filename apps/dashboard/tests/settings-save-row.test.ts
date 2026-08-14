import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

const ROW = read("../src/components/settings/settings-save-row.tsx");

// Every card on brand Settings that can be saved. Hand-rolled copies of the same
// row had drifted into a left-aligned button that was visible, and dead, before
// anyone had touched the form. The click-destination and sales-economics cards
// left this list with the flat brand-wide sections they belonged to: a funnel
// now owns its own rates, lifetime revenue and landing page.
const SAVEABLE_CARDS = ["brand-domain-card.tsx"];

describe("SettingsSaveRow", () => {
  // A Save button under an untouched form is a control offering itself for an
  // action there is nothing to do.
  it("renders nothing until something has been edited", () => {
    expect(ROW).toContain("if (!dirty && !saved) return null;");
  });

  it("only offers the button while there is something to save", () => {
    expect(ROW).toContain("{dirty && (");
  });

  // A single primary action belongs where the eye lands last.
  it("sits at the end of the row", () => {
    expect(ROW).toContain("justify-end");
  });

  // The check reports an action the user just took, so it outlives the save that
  // produced it and clears on the next edit.
  it("keeps the saved confirmation after the button goes away", () => {
    expect(ROW).toContain("{saved && !dirty && <span");
    expect(ROW).toContain("Saved ✓");
  });

  it("lets a card block the save for a reason of its own", () => {
    expect(ROW).toContain("disabled={disabled || saving}");
  });
});

describe("brand Settings cards", () => {
  it("route every Save through the shared row", () => {
    for (const file of SAVEABLE_CARDS) {
      const src = read(`../src/components/settings/${file}`);
      expect(src).toContain("<SettingsSaveRow");
      expect(src).toContain('from "@/components/settings/settings-save-row"');
    }
  });

  // The drift this replaces: a left-aligned row, and a button rendered whether
  // or not there was anything to save.
  it("keep no hand-rolled save row of their own", () => {
    for (const file of SAVEABLE_CARDS) {
      const src = read(`../src/components/settings/${file}`);
      expect(src).not.toContain('"Saving..."');
      expect(src).not.toContain('{saving ? "Saving..." : "Save"}');
      expect(src).not.toContain('className="mt-5 flex items-center gap-3"');
    }
  });

  // The domain card is a one-time setup on a brand with no website, so its field
  // starts empty by construction and a typed URL IS the edit.
  it("pass each card's own gate through the shared row", () => {
    const domain = read("../src/components/settings/brand-domain-card.tsx");
    expect(domain).toContain("dirty={value.trim().length > 0}");
  });
});
