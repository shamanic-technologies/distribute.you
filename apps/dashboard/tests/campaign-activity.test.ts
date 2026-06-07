import { describe, it, expect } from "vitest";
import {
  toActivityLabel,
  toActivityFeed,
  ACTIVITY_FEED_SIZE,
} from "../src/lib/campaign-activity";

// Minimal RunEvent-shaped factory — the feed only reads these fields.
function ev(
  over: Partial<{
    id: string;
    service: string;
    event: string;
    level: "info" | "warn" | "error";
    createdAt: string;
  }> = {},
) {
  return {
    id: over.id ?? "e1",
    service: over.service ?? "lead-service",
    event: over.event ?? "buffer-next-start",
    level: over.level ?? ("info" as const),
    createdAt: over.createdAt ?? "2026-06-07T03:00:00.000Z",
    // fields the feed ignores but RunEvent declares
    runId: "r1",
    detail: null,
    data: null,
    orgId: null,
    userId: null,
    brandIds: null,
    campaignId: null,
    workflowSlug: null,
    featureSlug: null,
  };
}

describe("toActivityLabel — allowlist + reassuring phrasing", () => {
  it("maps each real funnel slug to a present-tense phrase", () => {
    expect(toActivityLabel(ev({ service: "brand-service", event: "extract-fields-request" }))).toBe(
      "Analyzing your brand",
    );
    expect(toActivityLabel(ev({ service: "lead-service", event: "buffer-next-start" }))).toBe(
      "Finding your next lead",
    );
    expect(toActivityLabel(ev({ service: "apollo-service", event: "enrich-start" }))).toBe(
      "Finding the lead's email",
    );
    expect(
      toActivityLabel(ev({ service: "content-generation-service", event: "generate-start" })),
    ).toBe("Writing a personalized email");
    expect(toActivityLabel(ev({ service: "instantly-service", event: "send-start" }))).toBe(
      "Sending the email",
    );
  });

  it("hides infra / polling / orchestration noise (not allowlisted)", () => {
    expect(toActivityLabel(ev({ service: "billing-service", event: "customer_balance.authorize.start" }))).toBeNull();
    expect(toActivityLabel(ev({ service: "features-service", event: "feature-stats-start" }))).toBeNull();
    expect(toActivityLabel(ev({ service: "lead-service", event: "leads-query-start" }))).toBeNull();
    expect(toActivityLabel(ev({ service: "workflow-service", event: "windmill-dispatch" }))).toBeNull();
  });

  it("never surfaces an error event, even on an allowlisted slug — this surface reassures, not debugs", () => {
    expect(toActivityLabel(ev({ event: "send-start", level: "error" }))).toBeNull();
  });

  it("guards against a future slug collision via the service check", () => {
    // Some other service emitting `generate-start` must NOT borrow the label.
    expect(toActivityLabel(ev({ service: "some-other-service", event: "generate-start" }))).toBeNull();
  });
});

describe("toActivityFeed — newest-first, noise-resistant, capped", () => {
  it("keeps only displayable steps from a noise-heavy DESC window, newest first", () => {
    // Backend returns created_at DESC; recent window is mostly polling noise.
    const events = [
      ev({ id: "n1", service: "features-service", event: "feature-revenue-done" }),
      ev({ id: "n2", service: "lead-service", event: "leads-query-start" }),
      ev({ id: "a", service: "instantly-service", event: "send-start", createdAt: "2026-06-07T03:05:00.000Z" }),
      ev({ id: "b", service: "content-generation-service", event: "generate-start", createdAt: "2026-06-07T03:04:00.000Z" }),
      ev({ id: "c", service: "apollo-service", event: "enrich-start", createdAt: "2026-06-07T03:03:00.000Z" }),
      ev({ id: "d", service: "lead-service", event: "buffer-next-start", createdAt: "2026-06-07T03:02:00.000Z" }),
    ];
    const feed = toActivityFeed(events);
    expect(feed.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(feed[0].label).toBe("Sending the email");
  });

  it("caps at ACTIVITY_FEED_SIZE", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      ev({ id: `s${i}`, service: "instantly-service", event: "send-start" }),
    );
    expect(toActivityFeed(many)).toHaveLength(ACTIVITY_FEED_SIZE);
  });

  it("returns an empty feed (→ caller shows placeholder) when nothing is displayable", () => {
    const noise = [
      ev({ service: "billing-service", event: "customer_balance.usage_apply.start" }),
      ev({ service: "features-service", event: "feature-stats-start" }),
    ];
    expect(toActivityFeed(noise)).toEqual([]);
  });
});
