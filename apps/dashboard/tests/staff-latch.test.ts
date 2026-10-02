import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { latchedEmail } from "../src/lib/staff-latch";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("staff gate survives Clerk's user/isLoaded blink (Research data vanishing)", () => {
  it("a transient null keeps the last resolved email", () => {
    expect(latchedEmail("staff@x.com", null)).toBe("staff@x.com");
    expect(latchedEmail("staff@x.com", undefined)).toBe("staff@x.com");
  });

  it("a different signed-in email replaces it at once", () => {
    expect(latchedEmail("staff@x.com", "client@y.com")).toBe("client@y.com");
  });

  it("nothing resolved yet stays null", () => {
    expect(latchedEmail(null, undefined)).toBeNull();
  });

  it("useIsAdminUser reads the latched email, not the raw Clerk user", () => {
    const src = read("src/lib/use-admin-user.ts");
    const body = src.slice(src.indexOf("export function useIsAdminUser("));
    expect(body).toContain("latchedEmail(email.current, user?.primaryEmailAddress?.emailAddress)");
    expect(body).toContain("return isAdminEmail(email.current)");
  });

  it("StaffOnly never goes back to blank once Clerk has loaded", () => {
    const src = read("src/components/v2/staff-only.tsx");
    const body = src.slice(src.indexOf("export function StaffOnly("));
    expect(body).toContain("if (isLoaded) loadedOnce.current = true;");
    expect(body).toContain("if (!loadedOnce.current) return null;");
    expect(body).not.toContain("if (!isLoaded) return null;");
  });
});
