import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const middlewareSrc = fs.readFileSync(
  path.resolve(__dirname, "../../src/middleware.ts"),
  "utf-8",
);

describe("Landing middleware captures invite cookie", () => {
  it("reads `?invite=` from request URL", () => {
    expect(middlewareSrc).toContain('searchParams.get("invite")');
  });

  it("validates the slug before persisting", () => {
    expect(middlewareSrc).toContain("isValidInviteSlug");
  });

  it("uses the shared cookie name + max-age constants", () => {
    expect(middlewareSrc).toContain("INVITE_COOKIE_NAME");
    expect(middlewareSrc).toContain("INVITE_COOKIE_MAX_AGE_SECONDS");
  });

  it("sets SameSite=Lax and not HttpOnly (dashboard needs read access)", () => {
    expect(middlewareSrc).toContain('sameSite: "lax"');
    expect(middlewareSrc).toContain("httpOnly: false");
  });

  it("matcher excludes api + _next + static assets", () => {
    expect(middlewareSrc).toContain("api|_next/static|_next/image");
    expect(middlewareSrc).toContain("favicon.ico");
  });
});
