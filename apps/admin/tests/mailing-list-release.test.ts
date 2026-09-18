import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RELEASE_STATUS_BLURB,
  RELEASE_STATUS_LABEL,
  RELEASE_STATUS_TONE,
  estimatedRemainingLabel,
  isTerminal,
  paceProblemShape,
  releaseActivityLine,
  releaseControls,
  releaseProgressPct,
  releaseWriteErrorMessage,
  todayUsedPct,
  type MailingListRelease,
  type ReleaseStatus,
} from "../src/lib/mailing-list-release";

const STATUSES: ReleaseStatus[] = ["running", "paused", "cancelled", "halted", "completed"];

function release(over: Partial<MailingListRelease> = {}): MailingListRelease {
  return {
    releaseId: "r1",
    slug: "newsletter",
    subject: "Flash or Pro",
    from: "kevin@news.distribute.you",
    bodyKind: "html",
    status: "running",
    haltedReason: null,
    dailyLimit: 3000,
    recipientCount: 30013,
    reached: 4820,
    remaining: 25103,
    failed: 3,
    skippedOptedOut: 87,
    inFlight: 0,
    todayAllowance: 3000,
    todayUsed: 1820,
    estimatedDaysRemaining: 9,
    nextSliceSize: 20,
    createdAt: "2026-09-18T12:00:00.000Z",
    completedAt: null,
    ...over,
  };
}

describe("status vocabulary", () => {
  it("names every status, so a new one cannot ship unworded", () => {
    for (const s of STATUSES) {
      expect(RELEASE_STATUS_LABEL[s]).toBeTruthy();
      expect(RELEASE_STATUS_BLURB[s]).toBeTruthy();
      expect(RELEASE_STATUS_TONE[s]).toBeTruthy();
    }
  });

  it("tells a person stopping it apart from it stopping itself", () => {
    expect(RELEASE_STATUS_LABEL.paused).not.toBe(RELEASE_STATUS_LABEL.halted);
    expect(RELEASE_STATUS_BLURB.halted).toMatch(/on its own/i);
  });

  it("uses only tints admin's own html.dark layer actually remaps", () => {
    // Read globals.css rather than restate a list: a hardcoded allowlist here
    // would assert my own opinion, not the stylesheet. An unremapped text
    // weight renders near-black on the dark surface and is invisible in the
    // light default, so it ships unnoticed — which is exactly how green's
    // text and border weights went missing while its fill was remapped.
    const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");
    for (const status of STATUSES) {
      for (const cls of RELEASE_STATUS_TONE[status].split(" ")) {
        expect(
          css.includes(`html.dark .${cls} `) || css.includes(`html.dark .${cls}{`),
          `${cls} (status ${status}) has no html.dark remap in globals.css`
        ).toBe(true);
      }
    }
  });
});

describe("releaseControls", () => {
  it("offers pause only while running, resume only while paused", () => {
    expect(releaseControls("running")).toMatchObject({ canPause: true, canResume: false });
    expect(releaseControls("paused")).toMatchObject({ canPause: false, canResume: true });
  });

  it("never offers to resume a release that stopped itself", () => {
    // Resuming a halted release would let somebody un-make a safety decision
    // with one click. Sending the same update again is a new release.
    expect(releaseControls("halted").canResume).toBe(false);
    expect(releaseControls("halted").canCancel).toBe(false);
    expect(releaseControls("halted").canRepace).toBe(false);
  });

  it("offers nothing on a terminal release", () => {
    for (const s of STATUSES.filter(isTerminal)) {
      expect(Object.values(releaseControls(s)).some(Boolean)).toBe(false);
    }
  });
});

describe("releaseProgressPct", () => {
  it("is the served ratio", () => {
    expect(releaseProgressPct({ reached: 50, recipientCount: 200 })).toBe(25);
  });

  it("returns 0 rather than dividing by zero", () => {
    expect(releaseProgressPct({ reached: 0, recipientCount: 0 })).toBe(0);
  });

  it("clamps, because a bar overrunning its track reads as a fault", () => {
    expect(releaseProgressPct({ reached: 300, recipientCount: 200 })).toBe(100);
    expect(releaseProgressPct({ reached: -5, recipientCount: 200 })).toBe(0);
  });
});

describe("todayUsedPct", () => {
  it("is separate from overall progress", () => {
    // 3% through the list and 100% through today is the normal resting state
    // of a paced send; one number cannot say both.
    const r = release({ reached: 900, recipientCount: 30013, todayUsed: 3000, todayAllowance: 3000 });
    expect(todayUsedPct(r)).toBe(100);
    expect(releaseProgressPct(r)).toBeLessThan(5);
  });

  it("returns 0 on a zero allowance", () => {
    expect(todayUsedPct({ todayUsed: 0, todayAllowance: 0 })).toBe(0);
  });
});

describe("releaseActivityLine", () => {
  it("says a running release that spent today is RESTING, not stuck", () => {
    const line = releaseActivityLine(release({ todayUsed: 3000, todayAllowance: 3000, inFlight: 0 }));
    expect(line).toMatch(/rests until tomorrow/i);
  });

  it("reports what is in flight when something is", () => {
    expect(releaseActivityLine(release({ inFlight: 20 }))).toMatch(/20 in flight/);
  });

  it("falls back to the status blurb when not running", () => {
    expect(releaseActivityLine(release({ status: "halted" }))).toBe(RELEASE_STATUS_BLURB.halted);
  });
});

describe("releaseWriteErrorMessage", () => {
  it("passes the service's own reason through on a refusal", () => {
    expect(releaseWriteErrorMessage(409, "This release has already finished.")).toBe(
      "This release has already finished."
    );
    expect(releaseWriteErrorMessage(400, "A daily pace of 99999 is above what the worker can deliver.")).toMatch(
      /above what the worker can deliver/
    );
  });

  it("still answers when no reason was supplied", () => {
    expect(releaseWriteErrorMessage(409, null)).toBeTruthy();
    expect(releaseWriteErrorMessage(409, "   ")).toBeTruthy();
  });

  it("has a sentence for every branch, and never an empty one", () => {
    for (const code of [400, 403, 404, 409, 500, 502, null]) {
      expect(releaseWriteErrorMessage(code)).toBeTruthy();
    }
  });
});

describe("paceProblemShape", () => {
  it("accepts a whole number", () => {
    expect(paceProblemShape("3000")).toBeNull();
    expect(paceProblemShape(" 500 ")).toBeNull();
  });

  it("refuses what is not one", () => {
    expect(paceProblemShape("")).toBeTruthy();
    expect(paceProblemShape("abc")).toBeTruthy();
    expect(paceProblemShape("1.5")).toBeTruthy();
    expect(paceProblemShape("-10")).toBeTruthy();
    expect(paceProblemShape("0")).toBeTruthy();
  });

  it("does not claim to know the service's ceiling", () => {
    // The worker's real limit is the service's to enforce; checking it here
    // would be this console asserting a rule it does not own.
    expect(paceProblemShape("28801")).toBeNull();
    expect(paceProblemShape("999999")).toBeNull();
  });
});

describe("estimatedRemainingLabel", () => {
  it("reads the served estimate", () => {
    expect(estimatedRemainingLabel(release({ estimatedDaysRemaining: 9 }))).toMatch(/9 days/);
    expect(estimatedRemainingLabel(release({ estimatedDaysRemaining: 1 }))).toMatch(/a day/);
  });

  it("says nothing about a release with nothing left", () => {
    for (const s of STATUSES.filter(isTerminal)) {
      expect(estimatedRemainingLabel(release({ status: s }))).toBeNull();
    }
    expect(estimatedRemainingLabel(release({ estimatedDaysRemaining: 0 }))).toBeNull();
  });
});
