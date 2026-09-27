import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { channelBreakdown, channelLabel, AcquisitionListSchema } from "../src/lib/acquisition-breakdown";

const org = (real: boolean, channel: string | null) => ({
  orgId: Math.random().toString(),
  createdAt: "2026-09-26T10:00:00Z",
  real,
  acquisition: channel ? { channel } : null,
});

describe("signups by first-touch channel", () => {
  it("counts signups and signed-out starts apart, per channel", () => {
    const b = channelBreakdown({
      orgs: [org(true, "newsletter"), org(true, "newsletter"), org(false, "newsletter"), org(false, "direct"), org(true, "cold_email")],
    });
    expect(b.rows.map((r) => [r.channel, r.signedUp, r.started])).toEqual([
      ["newsletter", 2, 1],
      ["cold_email", 1, 0],
      ["direct", 0, 1],
    ]);
    expect(b.totalSignedUp).toBe(3);
    expect(b.totalStarted).toBe(2);
  });

  it("keeps an org with no record as NOT RECORDED, never as direct", () => {
    const b = channelBreakdown({ orgs: [org(true, null), org(true, "direct")] });
    expect(b.rows.find((r) => r.channel === "not_recorded")?.signedUp).toBe(1);
    expect(b.rows.find((r) => r.channel === "direct")?.signedUp).toBe(1);
  });

  it("reads a channel it does not know verbatim", () => {
    expect(channelLabel("tiktok_ads")).toBe("tiktok_ads");
  });

  it("parses the producer's real body (prod sample, 2026-09-27)", () => {
    const body = {
      orgs: [
        {
          orgId: "a652b91c-1677-4587-9a0f-e92f015548f8",
          name: null,
          createdAt: "2026-09-26T16:46:18.550Z",
          anonymous: true,
          claimedAt: null,
          real: false,
          acquisition: { channel: "direct", utmSource: null, landingPath: "/onboarding", recordedVia: "org_id" },
        },
      ],
    };
    expect(AcquisitionListSchema.safeParse(body).success).toBe(true);
  });

  it("is on the Signups tab, read server-side, and a failed read does not take the tab down", () => {
    const page = readFileSync(join(__dirname, "../src/app/(authed)/(dashboard)/metrics/page.tsx"), "utf8");
    expect(page).toContain("channelBreakdown(await fetchOrgAcquisitions(FIRST_TOUCH_CAPTURE_START))");
    expect(page).toContain('{view === "signups" && (\n          <SignupsByChannelCard');
    const card = readFileSync(join(__dirname, "../src/components/signups-by-channel-card.tsx"), "utf8");
    expect(card).not.toContain('"use client"');
    expect(card).not.toContain("—");
  });
});
