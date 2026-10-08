import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clerkUserIdFromDistinctId, formatOwnerPing, isStaffEmail } from "../src/lib/owner-ping";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("formatOwnerPing", () => {
  it("names a signed-in person, the site, the step and the country on one line", () => {
    expect(
      formatOwnerPing({
        event: "step",
        who: "Grace Kendrick · info.gracekendrick@gmail.com",
        domain: "acme.com",
        step: { label: "Pick who to write to", index: 4, total: 14 },
        country: "NG",
      }),
    ).toBe("➡️ Grace Kendrick · info.gracekendrick@gmail.com · acme.com · 4/14 Pick who to write to · NG");
  });

  it("calls a visitor with no account a visitor", () => {
    expect(formatOwnerPing({ event: "started", who: null, domain: "acme.com" })).toBe("🌐 Visitor (no account yet) · acme.com · entered their site");
  });

  it("names a person with an account who walks signed out, never as a new visitor", () => {
    expect(formatOwnerPing({ event: "step", who: "Palak Mishra · p@x.com", signedOut: true, domain: "savoir.ltd", step: { label: "Your campaigns", index: 10, total: 14 }, country: "IN" })).toBe(
      "➡️ Palak Mishra · p@x.com (has an account, signed out) · savoir.ltd · 10/14 Your campaigns · IN",
    );
  });

  it("states signup, wall, payment and launch", () => {
    expect(formatOwnerPing({ event: "signed_up", who: "Grace" })).toBe("🆕 Grace · signed up");
    expect(formatOwnerPing({ event: "wall", who: "Grace" })).toBe("🧱 Grace · reached the payment wall");
    expect(formatOwnerPing({ event: "paid", who: "Grace", amountUsd: 200 })).toBe("💳 Grace · paid $200");
    expect(formatOwnerPing({ event: "launched", who: "Grace" })).toBe("🚀 Grace · launched");
  });

  it("refuses a step ping without its step and a paid ping without its amount", () => {
    expect(() => formatOwnerPing({ event: "step", who: null })).toThrow();
    expect(() => formatOwnerPing({ event: "paid", who: null })).toThrow();
  });
});

describe("clerkUserIdFromDistinctId", () => {
  it("reads a Clerk user id, nothing else", () => {
    expect(clerkUserIdFromDistinctId("user_3Jv6ymUKqK3FUqi4DqMydrrqe2G")).toBe("user_3Jv6ymUKqK3FUqi4DqMydrrqe2G");
    for (const v of ["01a0e3d2-45d7-74a9-9adc-787099349fcb", "user_", "user_abc", "org_3Jv6yli8FcSj3mYoR9TtjQMd5RU", null, 42]) {
      expect(clerkUserIdFromDistinctId(v)).toBeNull();
    }
  });

  it("the client sends its PostHog id and the route looks it up only when signed out", () => {
    expect(src("src/lib/owner-ping-client.ts")).toContain("posthog.get_distinct_id");
    const route = src("src/app/api/public/owner-ping/route.ts");
    expect(route).toContain("userId ? null : clerkUserIdFromDistinctId(posthogDistinctId)");
    expect(route).toContain("users.getUser(knownUserId)");
  });
});

describe("isStaffEmail", () => {
  it("is the owner under every address, never a customer", () => {
    for (const e of ["kevin.lourd@gmail.com", "Kevin@distribute.you", "kevin.lourd+test@gmail.com", "kevin@pressbeat.io"]) {
      expect(isStaffEmail(e)).toBe(true);
    }
    for (const e of ["info.gracekendrick@gmail.com", "", null, undefined]) expect(isStaffEmail(e)).toBe(false);
  });
});

describe("every signup step pings the owner", () => {
  it("signup", () => {
    expect(src("src/components/auth-event-tracker.tsx")).toContain('pingOwner({ event: "signed_up" })');
  });

  it("site entered, each step reached, the payment wall", () => {
    const s = src("src/components/v2/get-started/get-started.tsx");
    expect(s).toContain('pingOwner({ event: "started"');
    expect(s).toContain('pingOwner({ event: "step"');
    expect(s).toContain('pingOwner({ event: "wall"');
  });

  it("payment and launch, on both payment surfaces", () => {
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      const s = src(f);
      expect(s).toContain('pingOwner({ event: "paid"');
      expect(s).toContain('pingOwner({ event: "launched"');
    }
  });

  it("the server names the caller from Clerk, never from the body, and drops the owner", () => {
    const s = src("src/app/api/public/owner-ping/route.ts");
    expect(s).toContain("currentUser()");
    expect(s).toContain("isStaffEmail(email)");
    expect(s).not.toMatch(/who:\s*z\./);
  });
});
