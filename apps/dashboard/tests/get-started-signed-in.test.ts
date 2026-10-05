import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A signed-in visitor never starts an anonymous walk.
 *
 * `apiCall` reads the Clerk session before the anonymous flag, so a walk started
 * by somebody signed in runs every call through the authed proxy under their
 * ACTIVE org. On 2026-09-28/29 a staff walk on /get-started created three test
 * brands (Asana, Xata, INPI) inside a paying customer's org and billed the reads
 * there. Both halves refuse it: the page before asking anything, the session
 * route whatever calls it.
 */
const ROUTE = readFileSync(resolve(__dirname, "../src/app/api/anon/session/route.ts"), "utf8");
const PAGE = readFileSync(
  resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"),
  "utf8",
);

describe("anonymous session route refuses a signed-in caller", () => {
  it("reads the Clerk session", () => {
    expect(ROUTE).toContain('import { auth } from "@clerk/nextjs/server"');
    expect(ROUTE).toContain("const { userId } = await auth();");
  });

  it("refuses BEFORE any org is created or seeded", () => {
    const guard = ROUTE.indexOf("if (userId)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(ROUTE.indexOf("createAnonymousOrg(anonOrgId"));
    expect(guard).toBeLessThan(ROUTE.indexOf("seedTrialCredit(orgId)"));
    expect(guard).toBeLessThan(ROUTE.indexOf("canReuseAnonSession(held"));
  });

  it("keeps the held session, which a just-signed-up visitor still claims with", () => {
    expect(ROUTE).toContain('"signed-in", { clearSession: false }');
  });
});

describe("get-started refuses to start a walk for a signed-in visitor", () => {
  const start = PAGE.slice(PAGE.indexOf("async function start(raw: string)"));

  it("checks the session before the anonymous session or the brand create", () => {
    // `org` is the dashboard's walk, which names its org explicitly (never the public URL).
    const guard = start.indexOf("if (isSignedIn && !org)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(start.indexOf("startAnonSession(url)"));
    expect(start).toContain("if (!org) {\n      const session = await startAnonSession(url);");
    expect(guard).toBeLessThan(start.indexOf("upsertBrand(url)"));
  });

  it("points at the dashboard instead", () => {
    expect(start).toContain("setInputError(SIGNED_IN_WALK_MESSAGE)");
    expect(start).toContain('href: "/v2"');
  });

  it("says the same words as the session route", () => {
    const words = "You are signed in. Add this brand from your dashboard instead.";
    expect(PAGE).toContain(words);
    expect(ROUTE).toContain(words);
  });
});
