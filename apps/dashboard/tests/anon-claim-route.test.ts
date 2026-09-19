import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = fs.readFileSync(
  path.join(__dirname, "../src/app/api/anon/claim/route.ts"),
  "utf8",
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Source-substring guards: a route handler cannot be imported here. The rules
 *  worth pinning are the ones whose failure costs a paying customer their work. */

describe("the one request that matters most in the flow", () => {
  it("refuses without BOTH a user and an org — signing up creates both", () => {
    expect(CODE).toContain("!userId || !orgId");
  });

  it("addresses the org by the INTERNAL uuid off the signed session", () => {
    // Not a value the browser sent, and not the external id: client-service
    // claims by internal uuid, which is what every write already used.
    expect(CODE).toContain("orgId: session.orgId");
  });

  it("KEEPS the token when the claim is refused — it is the only way back", () => {
    // Clearing on a refusal strands everything the visitor built.
    // Bounded by the refusal's OWN return rather than a guessed length: a
    // measured slice overshot into the success branch on the first run, which
    // legitimately does clear, and reported correct code as broken.
    const from = CODE.indexOf("if (!outcome.claimed)");
    const to = CODE.indexOf("status: 409", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(CODE.slice(from, to)).not.toContain("cleared(");
  });

  it("clears BOTH cookies once the org is genuinely theirs", () => {
    // Spelling changed with the cookie-append bug: `cookies.set(..., maxAge: 0)`
    // rather than two `Set-Cookie` header appends, which the browser collapses
    // into one. The rule is unchanged — both cookies go.
    expect(CODE).toContain("ANON_SESSION_COOKIE");
    expect(CODE).toContain("ANON_FLAG_COOKIE");
    expect(CODE).toMatch(/maxAge: 0/);
    expect((CODE.match(/res\.cookies\.set\(/g) ?? []).length).toBe(2);
  });

  it("treats a replayed claim as success, not an error", () => {
    expect(CODE).toContain("alreadyClaimed");
    // A replay must never take the refusal branch.
    expect(CODE).not.toMatch(/alreadyClaimed[\s\S]{0,80}status:\s*4\d\d/);
  });

  it("answers 200 when there is nothing to claim — an ordinary signup", () => {
    expect(CODE).toContain("nothingToClaim");
  });

  it("never reports a claim it did not make", () => {
    // `claimed: true` may appear exactly once, on the success path.
    expect((CODE.match(/claimed: true/g) ?? []).length).toBe(1);
  });

  it("substitutes nothing for a profile field Clerk does not have", () => {
    expect(CODE).not.toMatch(/firstName:\s*[^.]*\?\?\s*"/);
    expect(CODE).not.toContain('"Unknown"');
  });
});
