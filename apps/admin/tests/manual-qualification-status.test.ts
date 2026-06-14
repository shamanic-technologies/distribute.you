import { describe, expect, it } from "vitest";
import {
  MANUAL_QUALIFICATION_STATUSES,
  buildLatestQualificationMap,
  classificationPillClass,
  qualificationKey,
  statusLabel,
  statusToClassification,
} from "../src/lib/manual-qualification";
import type { ManualQualification } from "../src/lib/api";

describe("statusToClassification", () => {
  it("maps each Instantly status to the matching classification", () => {
    expect(statusToClassification("lead_interested")).toBe("positive");
    expect(statusToClassification("lead_meeting_booked")).toBe("positive");
    expect(statusToClassification("lead_closed")).toBe("positive");
    expect(statusToClassification("lead_not_interested")).toBe("negative");
    expect(statusToClassification("lead_wrong_person")).toBe("negative");
    expect(statusToClassification("lead_neutral")).toBe("neutral");
    expect(statusToClassification("lead_out_of_office")).toBe("neutral");
    expect(statusToClassification("auto_reply_received")).toBe("neutral");
  });

  it("covers every status in MANUAL_QUALIFICATION_STATUSES", () => {
    for (const status of MANUAL_QUALIFICATION_STATUSES) {
      const result = statusToClassification(status);
      expect(["positive", "negative", "neutral"]).toContain(result);
    }
  });
});

describe("statusLabel", () => {
  it("returns the user-facing label for each enum value", () => {
    expect(statusLabel("lead_interested")).toBe("Interested");
    expect(statusLabel("lead_meeting_booked")).toBe("Meeting booked");
    expect(statusLabel("lead_closed")).toBe("Closed (won)");
    expect(statusLabel("lead_not_interested")).toBe("Not interested");
    expect(statusLabel("lead_wrong_person")).toBe("Wrong person");
    expect(statusLabel("lead_neutral")).toBe("Neutral");
    expect(statusLabel("lead_out_of_office")).toBe("Out of office");
    expect(statusLabel("auto_reply_received")).toBe("Auto-reply");
  });
});

describe("classificationPillClass", () => {
  it("returns Tailwind class strings keyed on classification color", () => {
    expect(classificationPillClass("positive")).toContain("green");
    expect(classificationPillClass("negative")).toContain("red");
    expect(classificationPillClass("neutral")).toContain("gray");
  });
});

describe("qualificationKey", () => {
  it("composes campaignId + lowercased email", () => {
    expect(qualificationKey("c1", "Alice@Media.com")).toBe("c1|alice@media.com");
  });

  it("is order-stable (campaign first, then email)", () => {
    const a = qualificationKey("c1", "alice@media.com");
    const b = qualificationKey("c1", "alice@media.com");
    expect(a).toBe(b);
  });
});

describe("buildLatestQualificationMap", () => {
  function row(overrides: Partial<ManualQualification>): ManualQualification {
    return {
      id: "q1",
      orgId: "org_1",
      campaignId: "c1",
      instantlyCampaignId: "ic1",
      email: "a@b.com",
      status: "lead_interested",
      qualifiedBy: "user_1",
      notes: null,
      qualifiedAt: new Date("2026-05-24T10:00:00Z").toISOString(),
      ...overrides,
    };
  }

  it("keeps the first row per (campaignId, email) — backend returns DESC", () => {
    const map = buildLatestQualificationMap([
      row({ id: "newer", qualifiedAt: "2026-05-24T11:00:00Z", status: "lead_interested" }),
      row({ id: "older", qualifiedAt: "2026-05-24T09:00:00Z", status: "lead_not_interested" }),
    ]);
    expect(map.get("c1|a@b.com")?.id).toBe("newer");
  });

  it("indexes distinct (campaignId, email) pairs separately", () => {
    const map = buildLatestQualificationMap([
      row({ id: "q1", campaignId: "c1", email: "a@b.com" }),
      row({ id: "q2", campaignId: "c2", email: "a@b.com" }),
      row({ id: "q3", campaignId: "c1", email: "b@b.com" }),
    ]);
    expect(map.size).toBe(3);
    expect(map.get("c1|a@b.com")?.id).toBe("q1");
    expect(map.get("c2|a@b.com")?.id).toBe("q2");
    expect(map.get("c1|b@b.com")?.id).toBe("q3");
  });

  it("returns an empty map on empty input", () => {
    expect(buildLatestQualificationMap([]).size).toBe(0);
  });

  it("normalizes email case when keying", () => {
    const map = buildLatestQualificationMap([row({ email: "Alice@MEDIA.com" })]);
    expect(map.get("c1|alice@media.com")).toBeDefined();
  });
});
