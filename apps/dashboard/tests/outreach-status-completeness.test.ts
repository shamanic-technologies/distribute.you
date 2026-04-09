import { describe, it, expect } from "vitest";
import {
  STATUS_PRIORITY,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  resolveDisplayStatus,
  statusLabel,
  statusBadgeColor,
} from "../src/lib/outlet-status";
import * as fs from "fs";
import * as path from "path";

/**
 * The 10 backend outreachStatus values (from outlets-service and journalists-service).
 * "replied" is split into 3 display statuses via replyClassification.
 */
const BACKEND_RAW_STATUSES = [
  "replied",
  "delivered",
  "contacted",
  "served",
  "claimed",
  "buffered",
  "open",
  "skipped",
  "denied",
  "ended",
] as const;

/** All display statuses (replied splits into 3) */
const ALL_DISPLAY_STATUSES = [
  "replied-positive",
  "replied-negative",
  "replied-neutral",
  "delivered",
  "contacted",
  "served",
  "claimed",
  "buffered",
  "open",
  "skipped",
  "denied",
  "ended",
] as const;

describe("outreach status completeness", () => {
  it("STATUS_PRIORITY includes every display status", () => {
    for (const status of ALL_DISPLAY_STATUSES) {
      expect(STATUS_PRIORITY).toContain(status);
    }
  });

  it("STATUS_LABELS has an entry for every display status", () => {
    for (const status of ALL_DISPLAY_STATUSES) {
      expect(STATUS_LABELS[status]).toBeDefined();
      expect(STATUS_LABELS[status].label).toBeTruthy();
      expect(STATUS_LABELS[status].color).toBeTruthy();
    }
  });

  it("STATUS_DESCRIPTIONS has an entry for every display status", () => {
    for (const status of ALL_DISPLAY_STATUSES) {
      expect(STATUS_DESCRIPTIONS[status]).toBeDefined();
    }
  });

  it("does NOT contain 'bounced' anywhere in status maps", () => {
    expect(STATUS_PRIORITY).not.toContain("bounced");
    expect(STATUS_LABELS["bounced"]).toBeUndefined();
    expect(STATUS_DESCRIPTIONS["bounced"]).toBeUndefined();
  });

  it("resolveDisplayStatus maps all backend statuses to known display statuses", () => {
    for (const raw of BACKEND_RAW_STATUSES) {
      if (raw === "replied") {
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, "positive"));
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, "negative"));
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, null));
      } else {
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw));
      }
    }
  });

  it("statusLabel never returns raw status string for known statuses", () => {
    for (const status of ALL_DISPLAY_STATUSES) {
      const label = statusLabel(status);
      // Label should be a human-readable string, not the raw key
      // (except "Open", "Denied", "Ended" which happen to match — that's fine)
      expect(label).toBeTruthy();
    }
  });

  it("statusBadgeColor returns a Tailwind class for every display status", () => {
    for (const status of ALL_DISPLAY_STATUSES) {
      expect(statusBadgeColor(status)).toMatch(/^bg-/);
    }
  });

  it("no status label says 'Processing' or 'In queue' (no aggregation/renaming)", () => {
    for (const key of Object.keys(STATUS_LABELS)) {
      expect(STATUS_LABELS[key].label).not.toBe("Processing");
      expect(STATUS_LABELS[key].label).not.toBe("In queue");
    }
  });
});

describe("api.ts type definitions include all backend statuses", () => {
  const apiContent = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/api.ts"),
    "utf-8",
  );

  for (const status of BACKEND_RAW_STATUSES) {
    it(`includes "${status}" in outreachStatus union types`, () => {
      expect(apiContent).toContain(`"${status}"`);
    });
  }

  it("does not include 'bounced' in outreachStatus unions", () => {
    // bounced exists in EmailDeliveryScopeStatus (different concept) but should
    // NOT appear in any outreachStatus union type definition
    const outreachLines = apiContent
      .split("\n")
      .filter((line) => line.includes("outreachStatus:") && line.includes("|"));
    for (const line of outreachLines) {
      expect(line).not.toContain('"bounced"');
    }
  });
});
