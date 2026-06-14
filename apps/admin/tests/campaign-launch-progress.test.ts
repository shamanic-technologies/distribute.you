import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  LAUNCH_STEPS,
  launchStepFromEvents,
  hasContactedLead,
  domainFromUrls,
} from "../src/lib/campaign-launch-progress";

// Minimal event factory — launchStepFromEvents only reads service + event.
function ev(service: string, event: string) {
  return { service, event };
}

describe("launchStepFromEvents — step index from backend run-start signals", () => {
  it("is 0 when no signal events are present (default step active)", () => {
    expect(launchStepFromEvents([])).toBe(0);
    expect(
      launchStepFromEvents([
        ev("billing-service", "customer_balance.authorize.start"),
        ev("features-service", "feature-stats-start"),
      ]),
    ).toBe(0);
  });

  it("reaches step 1 on lead-service buffer-next-start", () => {
    expect(launchStepFromEvents([ev("lead-service", "buffer-next-start")])).toBe(1);
  });

  it("reaches step 2 on content-generation-service generate-start", () => {
    expect(launchStepFromEvents([ev("content-generation-service", "generate-start")])).toBe(2);
  });

  it("reaches step 3 on instantly-service send-start", () => {
    expect(launchStepFromEvents([ev("instantly-service", "send-start")])).toBe(3);
  });

  it("takes the max reached even when earlier signals scrolled out of the window", () => {
    // Only the latest signal remains in the polled window; earlier ones are gone.
    expect(launchStepFromEvents([ev("instantly-service", "send-start")])).toBe(3);
  });

  it("ignores a slug emitted by the wrong service (collision guard)", () => {
    expect(launchStepFromEvents([ev("some-other-service", "send-start")])).toBe(0);
    expect(launchStepFromEvents([ev("lead-service", "generate-start")])).toBe(0);
  });

  it("returns the furthest step across a mixed window", () => {
    expect(
      launchStepFromEvents([
        ev("lead-service", "buffer-next-start"),
        ev("content-generation-service", "generate-start"),
        ev("billing-service", "noise"),
      ]),
    ).toBe(2);
  });
});

describe("hasContactedLead — modal close condition", () => {
  it("is false when no lead is contacted", () => {
    expect(hasContactedLead([])).toBe(false);
    expect(hasContactedLead([{ contacted: false }, { contacted: false }])).toBe(false);
  });

  it("is true once any lead is contacted", () => {
    expect(hasContactedLead([{ contacted: false }, { contacted: true }])).toBe(true);
  });
});

describe("domainFromUrls — step-0 label hostname", () => {
  it("strips protocol and www from a full URL", () => {
    expect(domainFromUrls(["https://www.prompthub.ai/pricing"])).toBe("prompthub.ai");
  });

  it("accepts a bare domain", () => {
    expect(domainFromUrls(["prompthub.ai"])).toBe("prompthub.ai");
  });

  it("returns null for empty or malformed input", () => {
    expect(domainFromUrls([])).toBeNull();
    expect(domainFromUrls(["   "])).toBeNull();
  });

  it("skips a malformed URL and uses the next usable one", () => {
    expect(domainFromUrls(["http://", "acme.com"])).toBe("acme.com");
  });
});

describe("LAUNCH_STEPS — carries the four approved labels", () => {
  it("has exactly the four steps in order", () => {
    expect(LAUNCH_STEPS.map((s) => s.label)).toEqual([
      "Reading your website",
      "Finding leads matching your ICP",
      "Writing first batch of emails",
      "Setting up sending infrastructure",
    ]);
  });
});

describe("CampaignLaunchModal source — non-closable + reassurance copy", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/campaign/campaign-launch-modal.tsx"),
    "utf-8",
  );

  it("shows the title and renders the launch steps", () => {
    expect(src).toMatch(/Writing your first emails/);
    expect(src).toContain("LAUNCH_STEPS.map");
  });

  it("is non-closable — no Escape handler, no backdrop-onClick close", () => {
    expect(src).not.toMatch(/onKeyDown/);
    expect(src).not.toMatch(/key === "Escape"/);
    // The overlay div carries no onClick (only the explicit escape button does).
    expect(src).not.toMatch(/className="fixed inset-0[^"]*"\s+onClick/);
  });

  it("only blocks an ongoing, not-yet-contacted campaign (option B gate)", () => {
    expect(src).toContain('campaignStatus === "ongoing"');
    expect(src).toContain("!contacted");
  });
});
