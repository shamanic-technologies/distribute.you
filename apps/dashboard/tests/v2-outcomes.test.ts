import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { byDepth, outcomeOf, outcomeOfCrmStep, outcomesOf } from "../src/lib/v2/outcomes";
import { SERVED_STEPS } from "./fixtures/served-steps";
import { BrandOutcomesSchema, OutcomePeopleSchema, reachedBuckets, stepStatOf } from "../src/lib/v2/outcome-people";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("outcomes (owner 2026-10-10): one per step a running campaign lands on", () => {
  it("reads a step's people as the people who reached it (lead-service reachedStep), crm-service's token beside it", () => {
    expect(outcomeOf(SERVED_STEPS, "sales-cold-email-outreach", "conversation")).toEqual({
      key: "conversation",
      label: "Positive replies",
      items: { kind: "people", step: "conversation", crmStep: "positive_reply" },
    });
    expect(outcomeOf(SERVED_STEPS, "sales-cold-email-outreach", "website_visit")?.items).toEqual({ kind: "people", step: "website_visit", crmStep: "website_visit" });
    expect(outcomeOf(SERVED_STEPS, "ai-meeting-booking", "meeting_booked")?.items).toEqual({ kind: "people", step: "meeting_booked", crmStep: "meeting_booked" });
    expect(outcomeOf(SERVED_STEPS, null, "paid_client")?.items).toEqual({ kind: "people", step: "paid_client", crmStep: "sale" });
    // A retired form spelling is the one form step.
    expect(outcomeOf(SERVED_STEPS, null, "form_filled")).toMatchObject({ key: "form_submitted", items: { kind: "people", step: "form_submitted", crmStep: "form_submission" } });
  });

  it("a source finds leads, a publishing channel posts, anything else is not listed yet", () => {
    expect(outcomeOf(SERVED_STEPS, "sourcing-apollo-cold-filters", "lead_found")).toEqual({ key: "lead_found", label: "Leads", items: { kind: "leads-found" } });
    expect(outcomeOf(SERVED_STEPS, "organic-linkedin-publishing", null)).toMatchObject({ key: "posts", label: "Posts", items: { kind: "posts" } });
    // AI Instant Call's booking calls: lead-service's own bucket (v0.83.31).
    expect(outcomeOf(SERVED_STEPS, "ai-instant-call", "booking_call", "Booking call")).toEqual({
      key: "booking_call",
      label: "Booking calls",
      items: { kind: "people", step: "booking_call", crmStep: "booking_call" },
    });
    // A step no service lists people for: named with its served label, never guessed.
    expect(outcomeOf(SERVED_STEPS, "x", "some_new_step", "Some new step")).toEqual({ key: "some_new_step", label: "Some new step", items: { kind: "unavailable" } });
    expect(outcomeOf(SERVED_STEPS, "x", null)).toBeNull();
  });

  it("names every step by the catalogue's served plural, never a local map (owner 2026-10-15)", () => {
    const src = read("src/lib/v2/outcomes.ts");
    expect(src).toContain("stepPluralLabel(catalogue, key, singular)");
    expect(src).not.toContain("Leads found");
    expect(src).not.toMatch(/const PLURAL\b/);
    // The producer renames a step: the outcome reads the new word with no deploy here.
    const renamed = { steps: new Map([["lead_found", { key: "lead_found", label: "Prospect", pluralLabel: "Prospects" }]]) };
    expect(outcomeOf(renamed, "sourcing-apollo-cold-filters", "lead_found")?.label).toBe("Prospects");
    // A step served with no plural reads its served singular (and logs the gap).
    const bare = { steps: new Map([["lead_found", { key: "lead_found", label: "Lead" }]]) };
    expect(outcomeOf(bare, "sourcing-apollo-cold-filters", "lead_found")?.label).toBe("Lead");
  });

  it("sorts outcomes from the most advanced (paid client) to the least (lead found)", () => {
    const keys = ["conversation", "meeting_booked", "lead_found", "meeting_attended", "paid_client", "website_visit", "client_satisfied"];
    const sorted = byDepth(keys.map((k) => ({ outcome: outcomeOf(SERVED_STEPS, null, k)! })));
    expect(sorted.map((o) => o.outcome.label)).toEqual([
      "Clients Satisfied",
      "Paid clients",
      "Meetings attended",
      "Meetings booked",
      "Positive replies",
      "Website visits",
      "Leads",
    ]);
  });

  it("lists each step once, in campaign order", () => {
    const list = outcomesOf(SERVED_STEPS, [
      { featureSlug: "sourcing-apollo-cold-filters", toKey: "lead_found" },
      { featureSlug: "sales-cold-email-outreach", toKey: "conversation" },
      { featureSlug: "sourcing-apollo-buying-signals", toKey: "lead_found" },
      { featureSlug: "ai-meeting-booking", toKey: "meeting_booked" },
    ]);
    expect(list.map((o) => o.key)).toEqual(["lead_found", "conversation", "meeting_booked"]);
  });

  it("each outcome page lists served items: people table, source lists, or says not available", () => {
    const page = read("src/components/v2/outcomes-page.tsx");
    expect(page).toContain("<PeoplePage step={outcome.items.step} />");
    expect(page).toContain("<AudienceLists />");
    expect(page).toContain("Not available yet.");
    // Counts are lead-service's, never added up here.
    expect(page).toContain("useReachedCounts(brandId, outcomes.flatMap((o) => reachedStepOf(o.outcome) ?? []))");
    expect(page).not.toMatch(/\.reduce\(/);
  });

  it("every outcome of the brand, campaigns or not (owner 2026-10-11): crm-service's steps map onto outcomes", () => {
    expect(outcomeOfCrmStep(SERVED_STEPS, "website_visit")?.key).toBe("website_visit");
    expect(outcomeOfCrmStep(SERVED_STEPS, "sale")).toMatchObject({ key: "paid_client", label: "Paid clients", items: { kind: "people", step: "paid_client", crmStep: "sale" } });
    expect(outcomeOfCrmStep(SERVED_STEPS, "form_submission")?.key).toBe("form_submitted");
    expect(outcomeOfCrmStep(SERVED_STEPS, "nope")).toBeNull();
    // CLIENT-SATISFIED-1107: crm-service's people list for a paying client's positive message.
    expect(outcomeOfCrmStep(SERVED_STEPS, "client_satisfied")).toEqual({
      key: "client_satisfied",
      label: "Clients Satisfied",
      items: { kind: "people", step: "client_satisfied", crmStep: "client_satisfied" },
    });
    const served = BrandOutcomesSchema.parse({
      brandId: "b",
      scope: { status: "ready", lastBuiltAt: null, lastError: null },
      steps: [
        { step: "website_visit", people: 83, sources: [{ source: "posthog", people: 83 }], contactedByUs: 4 },
        { step: "signup", people: "120", sources: [{ source: "clerk", people: 94 }, { source: "posthog", people: 88 }], contactedByUs: 0 },
        { step: "form_submission", people: 0, sources: [], contactedByUs: 0 },
      ],
    });
    // Empty steps are not outcomes the brand has; counts are the producer's, coerced only.
    expect(reachedBuckets(served)).toEqual(["website_visit", "signup"]);
    expect(stepStatOf(served, "signup")?.people).toBe(120);
    expect(stepStatOf(null, "signup")).toBeNull();
    expect(
      OutcomePeopleSchema.safeParse({
        brandId: "b",
        step: "signup",
        total: 1,
        limit: 50,
        offset: 0,
        people: [
          {
            personId: "p1",
            personKey: "email:a@b.co",
            displayName: null,
            company: null,
            emails: ["a@b.co"],
            phones: [],
            reachedAt: null,
            sources: [{ source: "clerk", reachedAt: null }],
            contactedByUs: false,
            state: "unresolved",
            stateSource: "lead_service",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("the Overview and the sidebar read ONE list: running campaigns' steps plus every step the brand's tools state", () => {
    const page = read("src/components/v2/outcomes-page.tsx");
    const shell = read("src/components/v2/v2-shell.tsx");
    expect(page).toContain("useBrandOutcomeList(orgId, brandId, offerId)");
    expect(shell).toContain("useBrandOutcomeList(orgId, brandId, offerId)");
    // Everyone first, then the ones we contacted (lead-service's bucket, the column's figure).
    expect(page).toContain('{ key: "all", label: "Everyone", count: listed.all.people }');
    expect(page).toContain("<EveryoneTable crmStep={outcome.items.crmStep} />");
  });
  it("the Overview's Leads row states its figures, never a dash (owner 2026-10-21: 72 leads read as none)", () => {
    const page = read("src/components/v2/outcomes-page.tsx");
    // People = the lists' held people, the same key and figure as the sidebar entry.
    expect(page).toContain("useAudienceSnapshot(brandId, leadsFoundListed).data?.totals.people.held");
    expect(page).toContain('if (o.outcome.items.kind === "leads-found") return peopleHeld == null');
    // Contacted by us = the leads lead-service saw reach their first email (`reachedStepOf`).
    expect(page).toContain("const step = reachedStepOf(o.outcome);");
    expect(read("src/lib/v2/outcomes.ts")).toContain('if (outcome.items.kind === "leads-found") return EMAIL_SENT_STEP;');
  });
});
