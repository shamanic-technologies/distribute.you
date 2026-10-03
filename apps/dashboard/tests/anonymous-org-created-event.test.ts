import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The weekly brief's onboarding-start count (daily-update 04) is ONE population in two
// instruments: client-service's anonymous orgs and PostHog's `anonymous_org_created`,
// joined on org_id. These guards pin both halves of the join and the automation
// fingerprint that keeps our own QA walks out of the human count.
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const ROUTE = read("src/app/api/anon/session/route.ts");
const CLIENT = read("src/lib/anon-session-client.ts");
const INIT = read("src/instrumentation-client.ts");

describe("anonymous org creation is recorded in PostHog, keyed on the org", () => {
  it("the session route returns the created org id, only on the path that creates one", () => {
    expect(ROUTE).toContain("NextResponse.json({ started: true, created: true, orgId,");
    // The reuse path created nothing: it must not claim it did.
    const reuse = ROUTE.slice(ROUTE.indexOf("canReuseAnonSession(held"), ROUTE.indexOf("const claim ="));
    expect(reuse).not.toContain("created: true");
  });

  it("logs the user agent of every created org (the scripted POST no PostHog sees)", () => {
    expect(ROUTE).toContain('created org ${orgId} ua=${JSON.stringify(req.headers.get("user-agent")');
  });

  it("the browser captures the event with org_id when, and only when, an org was created", () => {
    expect(CLIENT).toContain('export const ANON_ORG_CREATED_EVENT = "anonymous_org_created"');
    const at = CLIENT.indexOf("if (body.created === true)");
    expect(at).toBeGreaterThan(-1);
    expect(CLIENT.slice(at, at + 400)).toContain("posthog.capture(ANON_ORG_CREATED_EVENT, { org_id: body.orgId, domain })");
  });

  it("every event carries the webdriver flag", () => {
    expect(INIT).toContain("posthog.register({ webdriver: navigator.webdriver === true })");
  });
});
