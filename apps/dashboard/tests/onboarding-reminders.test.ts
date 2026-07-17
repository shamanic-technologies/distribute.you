import { describe, it, expect } from "vitest";
import {
  audienceNudge,
  nextReminder,
  shouldShowNoAudienceBanner,
  welcomeSeenKey,
  reminderDismissKey,
  type AudienceNudge,
} from "../src/lib/onboarding-reminders";

const NONE: AudienceNudge = { tier: "none" };
const ZERO: AudienceNudge = { tier: "zero-active" };
const EXHAUSTED: AudienceNudge = { tier: "exhausted" };
const LOW: AudienceNudge = { tier: "low-remaining", remainingPct: 3 };

describe("audienceNudge", () => {
  it("zero-active when no active audience exists", () => {
    expect(audienceNudge([]).tier).toBe("zero-active");
    expect(audienceNudge([{ status: "suggested" }, { status: "archived" }]).tier).toBe(
      "zero-active",
    );
  });

  it("none when an active audience still has a healthy pool", () => {
    expect(
      audienceNudge([{ status: "active", availableToContactPct: 50 }]).tier,
    ).toBe("none");
  });

  it("none at exactly the threshold (>= 5% is still usable)", () => {
    expect(
      audienceNudge([{ status: "active", availableToContactPct: 5 }]).tier,
    ).toBe("none");
  });

  it("exhausted when every active audience is fully contacted (0%)", () => {
    expect(
      audienceNudge([
        { status: "active", availableToContactPct: 0 },
        { status: "active", availableToContactPct: 0 },
      ]).tier,
    ).toBe("exhausted");
  });

  it("low-remaining with the BEST remaining pct when all actives are below the threshold", () => {
    const n = audienceNudge([
      { status: "active", availableToContactPct: 0 },
      { status: "active", availableToContactPct: 4 },
      { status: "active", availableToContactPct: 2 },
    ]);
    expect(n.tier).toBe("low-remaining");
    expect(n.remainingPct).toBe(4);
  });

  it("none when at least one active audience is healthy, even if others are drained", () => {
    expect(
      audienceNudge([
        { status: "active", availableToContactPct: 0 },
        { status: "active", availableToContactPct: 50 },
      ]).tier,
    ).toBe("none");
  });

  it("treats an ABSENT pct as healthy (safe until human-service serves it)", () => {
    expect(audienceNudge([{ status: "active" }]).tier).toBe("none");
    // A depleted sibling does not fire while another active row has no pct yet.
    expect(
      audienceNudge([
        { status: "active", availableToContactPct: 0 },
        { status: "active" },
      ]).tier,
    ).toBe("none");
  });
});

describe("nextReminder", () => {
  const base = {
    hasAutoTopup: true,
    audienceNudge: NONE,
    topupDismissed: false,
    audienceDismissed: false,
  };

  it("returns null when nothing is blocking", () => {
    expect(nextReminder(base)).toBeNull();
  });

  it("shows topup first when auto-topup is off", () => {
    expect(nextReminder({ ...base, hasAutoTopup: false, audienceNudge: ZERO })).toBe(
      "topup",
    );
  });

  it("shows audience when topup is fine but no active audience", () => {
    expect(nextReminder({ ...base, audienceNudge: ZERO })).toBe("audience");
  });

  it("shows audience when active audiences are all exhausted", () => {
    expect(nextReminder({ ...base, audienceNudge: EXHAUSTED })).toBe("audience");
  });

  it("shows audience when active audiences are almost drained", () => {
    expect(nextReminder({ ...base, audienceNudge: LOW })).toBe("audience");
  });

  it("skips topup once dismissed this session, falls through to audience", () => {
    expect(
      nextReminder({
        ...base,
        hasAutoTopup: false,
        audienceNudge: ZERO,
        topupDismissed: true,
      }),
    ).toBe("audience");
  });

  it("returns null when every blocker is dismissed", () => {
    expect(
      nextReminder({
        hasAutoTopup: false,
        audienceNudge: ZERO,
        topupDismissed: true,
        audienceDismissed: true,
      }),
    ).toBeNull();
  });

  it("never shows a reminder for a resolved blocker even if undismissed", () => {
    // auto-topup on + a usable active audience → nothing, regardless of dismiss flags
    expect(nextReminder({ ...base, topupDismissed: false, audienceDismissed: false })).toBeNull();
  });

  describe("auto-reload-blocked card (e.g. India)", () => {
    // For a blocked brand auto-topup can never turn on (hasAutoTopup always false),
    // so the funding reminder is a recharge gated on being OUT OF CREDIT, never a
    // proactive nudge.
    const blocked = {
      ...base,
      hasAutoTopup: false,
      autoReloadSupported: false,
      audienceNudge: NONE,
    };

    it("does NOT nudge while the wallet still has credit", () => {
      expect(nextReminder({ ...blocked, outOfCredit: false })).toBeNull();
    });

    it("shows the recharge reminder once the wallet is out of credit", () => {
      expect(nextReminder({ ...blocked, outOfCredit: true })).toBe("topup");
    });

    it("stays quiet about funding when dismissed this session, even out of credit", () => {
      expect(
        nextReminder({ ...blocked, outOfCredit: true, topupDismissed: true }),
      ).toBeNull();
    });

    it("still surfaces the audience blocker when out of credit reminder is dismissed", () => {
      expect(
        nextReminder({
          ...blocked,
          outOfCredit: true,
          topupDismissed: true,
          audienceNudge: ZERO,
        }),
      ).toBe("audience");
    });
  });
});

describe("shouldShowNoAudienceBanner", () => {
  it("shows when a brand is in view with no usable audience and loaded", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", audienceNudge: ZERO, loaded: true }),
    ).toBe(true);
  });

  it("shows for exhausted and low-remaining tiers too", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", audienceNudge: EXHAUSTED, loaded: true }),
    ).toBe(true);
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", audienceNudge: LOW, loaded: true }),
    ).toBe(true);
  });

  it("hidden before the audiences query resolves (no flash)", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", audienceNudge: ZERO, loaded: false }),
    ).toBe(false);
  });

  it("hidden when at least one active audience is usable", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", audienceNudge: NONE, loaded: true }),
    ).toBe(false);
  });

  it("hidden off a brand route", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: null, audienceNudge: ZERO, loaded: true }),
    ).toBe(false);
  });
});

describe("storage keys", () => {
  it("scopes the welcome flag per user", () => {
    expect(welcomeSeenKey("user_123")).toBe("distribute:welcome-seen:user_123");
  });

  it("scopes a reminder dismissal per brand and kind", () => {
    expect(reminderDismissKey("b1", "topup")).toBe(
      "distribute:reminder-dismissed:topup:b1",
    );
    expect(reminderDismissKey("b1", "audience")).toBe(
      "distribute:reminder-dismissed:audience:b1",
    );
  });
});
