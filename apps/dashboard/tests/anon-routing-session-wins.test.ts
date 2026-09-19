import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * A CLERK SESSION OUTRANKS THE ANONYMOUS FLAG, ALWAYS.
 *
 * `distribute_anon` is a routing hint for a browser with NO account, and it
 * lives 24 hours. Only `/sign-up` clears it, through the claim — so a visitor
 * who started the signed-out setup, abandoned it and then SIGNED IN kept it,
 * and `apiCall` checked it BEFORE the Clerk branch. Every call in their
 * dashboard was therefore routed to the anonymous proxy, whose allowlist is
 * closed, and answered `403 Not available`.
 *
 * Nothing looked broken, which is what made it expensive to find: the
 * local-first cache paints the previous visit from disk, so the whole dashboard
 * read as healthy on stale numbers and the ONLY control that reported anything
 * was the leads export, which has no cache to fall back on.
 *
 * The comments are stripped before every assertion here: the block this pins
 * explains its own history, so a check against the raw source would match the
 * prose describing the shape it forbids.
 */

describe("apiCall picks the proxy by SESSION, not by the anonymous flag", () => {
  const src = strip(read("src/lib/api.ts"));
  const from = src.indexOf("const send = async (forceFreshToken = false)");
  const send = src.slice(from, src.indexOf("let response = await send();", from));

  it("reads the tab token BEFORE it looks at the flag", () => {
    expect(from).toBeGreaterThan(-1);
    const token = send.indexOf("const tabToken = await getTabSessionToken(forceFreshToken)");
    const flag = send.indexOf("browserHasAnonSession(document.cookie)");
    expect(token).toBeGreaterThan(-1);
    expect(flag).toBeGreaterThan(-1);
    // An index compare, because declaration ORDER is the whole invariant and it
    // is the one thing a plain `toContain` cannot see.
    expect(token).toBeLessThan(flag);
  });

  it("takes the anonymous proxy only when there is NO session", () => {
    const flag = send.indexOf("browserHasAnonSession(document.cookie)");
    // The condition guarding the anonymous URL, bounded to its own `if`.
    const condition = send.slice(send.lastIndexOf("if (", flag), flag);
    expect(condition).toContain("!tabToken");
    expect(send).toContain("url = `/api/anon/v1${endpoint}`");
  });

  it("never re-adds the flag-first branch", () => {
    // The exact shape that shipped the bug: the flag tested in an `else if`
    // ahead of the authed branch, with no reference to the session at all.
    expect(send).not.toMatch(
      /else if \(\s*typeof document !== "undefined" && browserHasAnonSession/,
    );
  });

  it("a signed-in browser sends its bearer and its active org", () => {
    expect(send).toContain('headers["Authorization"] = `Bearer ${tabToken}`');
    expect(send).toContain('headers["x-active-org-id"] = activeOrgId');
  });
});
