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
 * Backend outreachStatus values per entity type.
 *   - Outlet (10): replied, delivered, contacted, served, claimed, buffered, open, skipped, denied, ended
 *   - Journalist (8): replied, delivered, contacted, served, claimed, buffered, bounced, skipped
 *
 * Outlet-only: open, denied, ended
 * Journalist-only: bounced
 */
const OUTLET_RAW_STATUSES = [
  "replied", "delivered", "contacted", "served", "claimed", "buffered", "open", "skipped", "denied", "ended",
] as const;

const JOURNALIST_RAW_STATUSES = [
  "replied", "delivered", "contacted", "served", "claimed", "buffered", "bounced", "skipped",
] as const;

/** Union of all display statuses across both entity types (replied splits into 3) */
const ALL_DISPLAY_STATUSES = [
  "replied-positive", "replied-negative", "replied-neutral",
  "delivered", "bounced", "contacted", "served", "claimed", "buffered",
  "open", "skipped", "denied", "ended",
] as const;

describe("outreach status completeness (shared display map)", () => {
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

  it("resolveDisplayStatus maps all outlet statuses to known display statuses", () => {
    for (const raw of OUTLET_RAW_STATUSES) {
      if (raw === "replied") {
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, "positive"));
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, "negative"));
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, null));
      } else {
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw));
      }
    }
  });

  it("resolveDisplayStatus maps all journalist statuses to known display statuses", () => {
    for (const raw of JOURNALIST_RAW_STATUSES) {
      if (raw === "replied") {
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, "positive"));
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, "negative"));
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw, null));
      } else {
        expect(ALL_DISPLAY_STATUSES).toContain(resolveDisplayStatus(raw));
      }
    }
  });

  it("statusLabel returns a truthy label for every display status", () => {
    for (const status of ALL_DISPLAY_STATUSES) {
      expect(statusLabel(status)).toBeTruthy();
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

describe("api.ts type definitions match per-entity status sets", () => {
  const apiContent = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/api.ts"),
    "utf-8",
  );
  const lines = apiContent.split("\n");

  // Find all outreachStatus union type lines
  const outreachLines = lines.filter((l) => l.includes("outreachStatus:") && l.includes("|"));

  // CampaignOutlet still uses flat outletStatus; DeduplicatedOutlet/OutletCampaign use structured status object
  it("CampaignOutlet outletStatus includes open", () => {
    const outletLines = lines.filter(
      (l) => l.includes("outletStatus:") && l.includes('"open"'),
    );
    expect(outletLines.length).toBeGreaterThanOrEqual(1);
  });

  it("CampaignOutlet outletStatus does NOT include bounced", () => {
    const outletLines = lines.filter(
      (l) => l.includes("outletStatus:") && l.includes('"open"'),
    );
    for (const line of outletLines) {
      expect(line).not.toContain('"bounced"');
    }
  });

  it("JournalistStatusBooleans includes bounced as a boolean field", () => {
    const match = apiContent.match(
      /export interface JournalistStatusBooleans \{([\s\S]*?)\n\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toContain("bounced: boolean");
    expect(body).toContain("contacted: boolean");
    expect(body).toContain("sent: boolean");
    expect(body).toContain("delivered: boolean");
    expect(body).toContain("opened: boolean");
    expect(body).toContain("replied: boolean");
  });

  it("EnrichedJournalist uses JournalistStatusBooleans (not outreachStatus string)", () => {
    const match = apiContent.match(
      /export interface EnrichedJournalist \{([\s\S]*?)\n\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toContain("brand: JournalistStatusBooleans");
    expect(body).toContain("campaign: JournalistStatusBooleans");
    expect(body).not.toContain("outreachStatus:");
  });
});
