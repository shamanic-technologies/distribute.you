import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reproduction of GET-STARTED-NO-WELCOME-EMAIL-1020, driven for real: the tracker's effect
 * and the signup-emails module run, only the network (`sendAuthNotification`), Clerk and the
 * router are stubbed. The prod case: an account made on /get-started at 18:11 that got no
 * welcome and no signup_notification.
 */

const sent: string[] = [];
let failNext = false;
vi.mock("@/lib/api", () => ({
  sendAuthNotification: vi.fn(async (eventType: string) => {
    if (failNext) throw new Error("502");
    sent.push(eventType);
    return {};
  }),
}));
vi.mock("@/lib/owner-ping-client", () => ({ pingOwner: vi.fn() }));

let clerk: { isSignedIn: boolean; orgId: string | null; user: { id: string; createdAt: Date; primaryEmailAddress: { emailAddress: string } } | null };
let pathname = "/v2/orgs/org_staff";
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: clerk.isSignedIn, orgId: clerk.orgId }),
  useUser: () => ({ user: clerk.user, isLoaded: true }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
// Effects run at render; one ref per mount, like a real component instance.
vi.mock("react", async (orig) => {
  const real = (await orig()) as object;
  return { ...real, useEffect: (fn: () => void) => fn(), useRef: (v: unknown) => ({ current: v }) };
});

function storage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const count = (e: string) => sent.filter((x) => x === e).length;

beforeEach(() => {
  sent.length = 0;
  failNext = false;
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  pathname = "/v2/orgs/org_staff";
  clerk = {
    isSignedIn: true,
    orgId: "org_staff",
    user: { id: "user_staff", createdAt: new Date(Date.now() - 30_000), primaryEmailAddress: { emailAddress: "k.lourd+gs@example.test" } },
  };
});

async function mountTracker() {
  const { AuthEventTracker } = await import("../src/components/auth-event-tracker");
  AuthEventTracker();
  await flush();
}

describe("a /get-started signup (no /sign-up flag anywhere)", () => {
  it("gets exactly one welcome and one signup_notification: the wall after its claim, then the dashboard", async () => {
    const { sendSignupEmailsOnce } = await import("../src/lib/signup-emails");
    // The wall: on /get-started the shell stays silent, the claim sends.
    pathname = "/get-started";
    await mountTracker();
    expect(sent).toEqual([]);
    await sendSignupEmailsOnce({ userId: clerk.user!.id, createdAt: clerk.user!.createdAt });
    // The launch lands them on the campaign page: the shell sees a new account again.
    pathname = "/v2/orgs/org_staff/brands/b/campaigns/c";
    await mountTracker();
    expect(count("welcome")).toBe(1);
    expect(count("signup_notification")).toBe(1);
  });

  it("an account that never reached the wall's claim still gets them on the dashboard", async () => {
    await mountTracker();
    expect(count("welcome")).toBe(1);
    expect(count("signup_notification")).toBe(1);
  });

  it("waits for the org the emails are scoped to", async () => {
    clerk.orgId = null;
    await mountTracker();
    expect(sent).toEqual([]);
    clerk.orgId = "org_staff";
    await mountTracker();
    expect(count("welcome")).toBe(1);
  });

  it("a failed send is retried on the next page load", async () => {
    failNext = true;
    await mountTracker();
    expect(sent).toEqual([]);
    failNext = false;
    await mountTracker();
    expect(count("welcome")).toBe(1);
    expect(count("signup_notification")).toBe(1);
  });
});

describe("a past signup", () => {
  it("gets nothing (no resend)", async () => {
    clerk.user!.createdAt = new Date("2026-10-07T09:00:00Z");
    await mountTracker();
    const { sendSignupEmailsOnce } = await import("../src/lib/signup-emails");
    await sendSignupEmailsOnce({ userId: clerk.user!.id, createdAt: clerk.user!.createdAt });
    expect(sent).toEqual([]);
  });
});

describe("the launch", () => {
  it("sends goal_launched", async () => {
    const { sendLaunchEmail } = await import("../src/lib/signup-emails");
    await sendLaunchEmail();
    expect(sent).toEqual(["goal_launched"]);
  });
});
