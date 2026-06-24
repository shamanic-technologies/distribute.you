import { describe, it, expect } from "vitest";
import {
  nextReminder,
  shouldShowNoAudienceBanner,
  welcomeSeenKey,
  reminderDismissKey,
} from "../src/lib/onboarding-reminders";

describe("nextReminder", () => {
  const base = {
    hasAutoTopup: true,
    activeAudienceCount: 1,
    topupDismissed: false,
    audienceDismissed: false,
  };

  it("returns null when nothing is blocking", () => {
    expect(nextReminder(base)).toBeNull();
  });

  it("shows topup first when auto-topup is off", () => {
    expect(nextReminder({ ...base, hasAutoTopup: false, activeAudienceCount: 0 })).toBe(
      "topup",
    );
  });

  it("shows audience when topup is fine but no active audience", () => {
    expect(nextReminder({ ...base, activeAudienceCount: 0 })).toBe("audience");
  });

  it("skips topup once dismissed this session, falls through to audience", () => {
    expect(
      nextReminder({
        ...base,
        hasAutoTopup: false,
        activeAudienceCount: 0,
        topupDismissed: true,
      }),
    ).toBe("audience");
  });

  it("returns null when every blocker is dismissed", () => {
    expect(
      nextReminder({
        hasAutoTopup: false,
        activeAudienceCount: 0,
        topupDismissed: true,
        audienceDismissed: true,
      }),
    ).toBeNull();
  });

  it("never shows a reminder for a resolved blocker even if undismissed", () => {
    // auto-topup on + 1 active audience → nothing, regardless of dismiss flags
    expect(nextReminder({ ...base, topupDismissed: false, audienceDismissed: false })).toBeNull();
  });
});

describe("shouldShowNoAudienceBanner", () => {
  it("shows when a brand is in view with zero active audiences and loaded", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", activeAudienceCount: 0, loaded: true }),
    ).toBe(true);
  });

  it("hidden before the audiences query resolves (no flash)", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", activeAudienceCount: 0, loaded: false }),
    ).toBe(false);
  });

  it("hidden when at least one active audience exists", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: "b1", activeAudienceCount: 2, loaded: true }),
    ).toBe(false);
  });

  it("hidden off a brand route", () => {
    expect(
      shouldShowNoAudienceBanner({ brandId: null, activeAudienceCount: 0, loaded: true }),
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
