import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PIN_COUNT, parseOutcomePins, shownPins, togglePin } from "../src/lib/v2/outcome-pins";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("outcome pins (owner 2026-11-07: pin outcomes in the sidebar instead of listing them all)", () => {
  const listed = [
    { key: "a", count: 5 },
    { key: "b", count: 50 },
    { key: "c", count: null },
    { key: "d", count: 12 },
    { key: "e", count: 7 },
  ];

  it("with no pin of the user's own, shows the biggest counts, a loading count last", () => {
    expect(DEFAULT_PIN_COUNT).toBe(3);
    expect(shownPins(null, listed)).toEqual(["b", "d", "e"]);
  });

  it("the user's own pins replace the default, in their order, only those still listed", () => {
    expect(shownPins(["c", "a", "gone"], listed)).toEqual(["c", "a"]);
    expect(shownPins([], listed)).toEqual([]);
  });

  it("a click toggles from what the sidebar showed, so the default is kept", () => {
    expect(togglePin(["b", "d", "e"], "a")).toEqual(["b", "d", "e", "a"]);
    expect(togglePin(["b", "d", "e"], "d")).toEqual(["b", "e"]);
  });

  it("a stored value that is not a list of keys reads as never chosen, loudly", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseOutcomePins(null)).toBeNull();
    expect(parseOutcomePins('["a","b"]')).toEqual(["a", "b"]);
    expect(parseOutcomePins("{")).toBeNull();
    expect(parseOutcomePins("[1]")).toBeNull();
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it("the sidebar lists only pinned outcomes, the page being read always kept", () => {
    const shell = read("src/components/v2/v2-shell.tsx");
    const at = shell.indexOf('<Group title="Outcomes">');
    const group = shell.slice(at, shell.indexOf("</Group>", at));
    expect(shell).toContain("const pinned = shownPins(ownPins, [");
    expect(shell).toContain("usePublishShownPins(brandId, pinned);");
    expect(group).toContain("if (!pinned.includes(outcome.key) && pathname !== href) return null;");
    expect(group).toContain("pinned.includes(key) || pathname === v2OutcomeHref(orgId, brandId, key)");
  });

  it("every outcome page and Overview card carries the Pin button", () => {
    const outcomes = read("src/components/v2/outcomes-page.tsx");
    expect(outcomes).toContain("<OutcomePinButton brandId={brandId} outcomeKey={outcome.key} />");
    expect(outcomes).toContain("<OutcomePinButton brandId={brandId} outcomeKey={o.outcome.key} compact />");
    const published = read("src/components/v2/published-outcome-page.tsx");
    expect(published).toContain("<OutcomePinButton brandId={brandId} outcomeKey={outcomeKey} />");
    expect(published).toContain("<OutcomePinButton brandId={brandId} outcomeKey={outcomeKey} compact />");
  });
});
