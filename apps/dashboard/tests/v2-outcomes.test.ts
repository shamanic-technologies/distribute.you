import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { outcomeOf, outcomesOf } from "../src/lib/v2/outcomes";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("outcomes (owner 2026-10-10): one per step a running campaign lands on", () => {
  it("reads a step's people from lead-service's bucket for it", () => {
    expect(outcomeOf("sales-cold-email-outreach", "conversation")).toEqual({
      key: "conversation",
      label: "Positive replies",
      items: { kind: "people", bucket: "positive_reply" },
    });
    expect(outcomeOf("sales-cold-email-outreach", "website_visit")?.items).toEqual({ kind: "people", bucket: "website_visit" });
    expect(outcomeOf("ai-meeting-booking", "meeting_booked")?.items).toEqual({ kind: "people", bucket: "meeting_booked" });
    expect(outcomeOf(null, "paid_client")?.items).toEqual({ kind: "people", bucket: "sale" });
    // A retired form spelling is the one form step.
    expect(outcomeOf(null, "form_filled")).toMatchObject({ key: "form_submitted", items: { kind: "people", bucket: "form_submission" } });
  });

  it("a source finds leads, a publishing channel posts, anything else is not listed yet", () => {
    expect(outcomeOf("sourcing-apollo-cold-filters", "lead_found")).toEqual({ key: "lead_found", label: "Leads found", items: { kind: "leads-found" } });
    expect(outcomeOf("organic-linkedin-publishing", null)).toMatchObject({ key: "posts", label: "Posts", items: { kind: "posts" } });
    // A step no service lists people for: named with its served label, never guessed.
    expect(outcomeOf("ai-instant-call", "booking_call", "Booking call")).toEqual({
      key: "booking_call",
      label: "Booking call",
      items: { kind: "unavailable" },
    });
    expect(outcomeOf("x", null)).toBeNull();
  });

  it("lists each step once, in campaign order", () => {
    const list = outcomesOf([
      { featureSlug: "sourcing-apollo-cold-filters", toKey: "lead_found" },
      { featureSlug: "sales-cold-email-outreach", toKey: "conversation" },
      { featureSlug: "sourcing-apollo-buying-signals", toKey: "lead_found" },
      { featureSlug: "ai-meeting-booking", toKey: "meeting_booked" },
    ]);
    expect(list.map((o) => o.key)).toEqual(["lead_found", "conversation", "meeting_booked"]);
  });

  it("each outcome page lists served items: people table, source lists, or says not available", () => {
    const page = read("src/components/v2/outcomes-page.tsx");
    expect(page).toContain("<PeoplePage bucket={outcome.items.bucket} />");
    expect(page).toContain("<AudienceLists />");
    expect(page).toContain("Not available yet.");
    // Counts are lead-service's, never added up here.
    expect(page).toContain("useBucketCounts(brandId)");
    expect(page).not.toMatch(/\.reduce\(/);
  });
});
