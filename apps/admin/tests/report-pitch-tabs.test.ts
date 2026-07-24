import { describe, it, expect } from "vitest";
import {
  PITCH_STATUS_TABS,
  tabForSlug,
  pitchesForTab,
  countsByTab,
  pitchStatusLabel,
  toDomain,
  timeAgo,
} from "../src/lib/report-pitch-tabs";
import type { QuotePitch } from "../src/lib/api";

function pitch(status: QuotePitch["status"]): QuotePitch {
  // Only `status` matters for the tab logic; the rest is filler.
  return { status } as unknown as QuotePitch;
}

describe("toDomain — logo domain from a bare outlet OR a URL, never the pitchUrl", () => {
  it("returns a bare outlet domain as-is (mediaOutlet is already a domain)", () => {
    expect(toDomain("7shifts.com")).toBe("7shifts.com");
    expect(toDomain("azbigmedia.com")).toBe("azbigmedia.com");
  });

  it("strips scheme + www from a full URL", () => {
    expect(toDomain("https://www.forbes.com/sites/x")).toBe("forbes.com");
  });

  it("returns null for empty / nullish", () => {
    expect(toDomain(null)).toBeNull();
    expect(toDomain("")).toBeNull();
    expect(toDomain(undefined)).toBeNull();
  });

  it("the connectively.us pitch link resolves to connectively.us (why it must NOT feed the logo)", () => {
    // This is the exact value that produced the same logo on every row — the
    // view must key the logo on mediaOutlet, not this.
    expect(toDomain("https://www.connectively.us/public-link/azbigmedia/x")).toBe(
      "connectively.us",
    );
  });
});

describe("PITCH_STATUS_TABS — status mapping", () => {
  it("maps each stage tab; In Review = submitted", () => {
    expect(tabForSlug("published")?.statuses).toEqual(["published"]);
    expect(tabForSlug("selected")?.statuses).toEqual(["selected"]);
    // In Review = SENT, still awaiting (not in the Selected/Published pages).
    expect(tabForSlug("in-review")?.statuses).toEqual(["submitted"]);
  });

  it("All = everything submitted incl rejected (Connectively's pitched total)", () => {
    expect(tabForSlug("all")?.statuses).toEqual([
      "submitted",
      "selected",
      "published",
      "not_selected",
    ]);
  });

  it("Pitched tab was removed (redundant with All) → unknown slug", () => {
    expect(tabForSlug("pitched")).toBeNull();
  });

  it("has exactly 4 tabs in reverse-funnel order (All last) with a dateLabel each", () => {
    expect(PITCH_STATUS_TABS.map((t) => t.slug)).toEqual([
      "published",
      "selected",
      "in-review",
      "all",
    ]);
    expect(PITCH_STATUS_TABS.map((t) => t.dateLabel)).toEqual([
      "Published",
      "Selected",
      "Submitted",
      "Pitched",
    ]);
  });

  it("returns null for an unknown slug", () => {
    expect(tabForSlug("bogus")).toBeNull();
  });
});

describe("countsByTab / pitchesForTab", () => {
  it("buckets: In Review = submitted, All = submitted+selected+published+not_selected", () => {
    const pitches = [
      pitch("submitted"),
      pitch("submitted"),
      pitch("published"),
      pitch("drafted"), // hidden — un-sent pre-send state, no tab
      pitch("not_selected"), // rejected — only in All
    ];
    const counts = countsByTab(pitches);
    expect(counts).toEqual({
      published: 1,
      selected: 0,
      "in-review": 2,
      all: 4, // 2 submitted + 0 selected + 1 published + 1 not_selected
    });
    expect(pitchesForTab(pitches, tabForSlug("in-review")!)).toHaveLength(2);
    expect(pitchesForTab(pitches, tabForSlug("all")!)).toHaveLength(4);
  });
});

describe("pitchStatusLabel — All-tab Status column", () => {
  it("maps the wire status onto the funnel-stage vocabulary", () => {
    expect(pitchStatusLabel("submitted")).toBe("In Review");
    expect(pitchStatusLabel("selected")).toBe("Selected");
    expect(pitchStatusLabel("published")).toBe("Published");
    expect(pitchStatusLabel("not_selected")).toBe("Not selected");
  });
});

describe("timeAgo", () => {
  it("formats a recent instant + handles null", () => {
    const now = new Date("2026-07-22T12:00:00Z");
    expect(timeAgo("2026-07-22T11:58:00Z", now)).toBe("2m ago");
    expect(timeAgo("2026-07-22T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo(null, now)).toBe("—");
  });
});
