import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANON_ORG_CREATED_EVENT,
  anonOrgCreatedPayload,
  readPosthogDistinctId,
  recordAnonOrgCreated,
} from "../src/lib/anon-org-created-event";

// The weekly brief's onboarding-start count (daily-update 04) is ONE population in two
// instruments: client-service's anonymous orgs and PostHog's `anonymous_org_created`,
// joined on org_id. The SERVER records it: posthog-js sends nothing from an automated
// browser, which is exactly the population the count must tell apart.
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const ROUTE = read("src/app/api/anon/session/route.ts");
const CLIENT = read("src/lib/anon-session-client.ts");

const base = { orgId: "6748dda4-6957-423e-bb50-b95ae8885ac5", domain: "home.cern", userAgent: "UA", webdriver: true };

describe("anonymous_org_created payload", () => {
  it("lands on the visitor's PostHog person when the browser named it", () => {
    const p = anonOrgCreatedPayload("phc_x", { ...base, posthogDistinctId: "0199abcd-ef01-7000-8000-000000000001" });
    expect(p.event).toBe(ANON_ORG_CREATED_EVENT);
    expect(p.distinct_id).toBe("0199abcd-ef01-7000-8000-000000000001");
    expect(p.properties).toMatchObject({ org_id: base.orgId, webdriver: true, $raw_user_agent: "UA", domain: "home.cern" });
    expect(p.properties).not.toHaveProperty("$process_person_profile");
  });

  it("keys on the org, with no person minted, when the browser runs no PostHog", () => {
    const p = anonOrgCreatedPayload("phc_x", { ...base, posthogDistinctId: null });
    expect(p.distinct_id).toBe(`anon-org:${base.orgId}`);
    expect(p.properties.$process_person_profile).toBe(false);
  });

  it("accepts only an id shaped like posthog-js mints", () => {
    expect(readPosthogDistinctId("0199abcd-ef01-7000-8000-000000000001")).toBe("0199abcd-ef01-7000-8000-000000000001");
    expect(readPosthogDistinctId("short")).toBeNull();
    expect(readPosthogDistinctId("a b c d e f g h")).toBeNull();
    expect(readPosthogDistinctId(42)).toBeNull();
  });
});

describe("recordAnonOrgCreated", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("posts to the PostHog capture endpoint and never throws when PostHog fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_x");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://e.example/");
    const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordAnonOrgCreated({ ...base, posthogDistinctId: null })).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("https://e.example/i/v0/e/");
    expect(String(err.mock.calls[0][0])).toContain(base.orgId);
  });
});

describe("the session route and the browser", () => {
  it("records the event on the path that creates an org, and only there", () => {
    const create = ROUTE.indexOf("createAnonymousOrg(anonOrgId");
    expect(ROUTE.indexOf("await recordAnonOrgCreated({ orgId, domain, userAgent, webdriver, posthogDistinctId })")).toBeGreaterThan(create);
    const reuse = ROUTE.slice(ROUTE.indexOf("canReuseAnonSession(held"), ROUTE.indexOf("const claim ="));
    expect(reuse).not.toContain("recordAnonOrgCreated");
  });

  it("the browser states its automation flag and PostHog id, and captures no duplicate", () => {
    expect(CLIENT).toContain("webdriver: navigator.webdriver === true");
    expect(CLIENT).toContain("posthogDistinctId: posthog.get_distinct_id?.() ?? null");
    expect(CLIENT).not.toContain("posthog.capture(");
  });
});
