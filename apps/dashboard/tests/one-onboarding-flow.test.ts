import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ONE ONBOARDING FLOW. `/start` used to be its own route handing off to the v1
// wizard through a cookie; the owner read the seam as two products. Onboarding
// v2 (`/get-started`) is now the only flow, and `/start` just redirects to it.

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

describe("/start is onboarding v2", () => {
  it("redirects to onboarding v2 with the query, relatively, and hosts no page of its own", () => {
    const route = read("src/app/start/route.ts");
    // 307: a permanent redirect is cached by the browser, and this one may move again.
    expect(route).toContain("status: 307");
    expect(route).toContain("Location: `/get-started${search}`");
    // `request.url` on a self-hosted Next server is the bind address, so an
    // absolute Location built from it points at the container.
    expect(route).not.toContain("NextResponse.redirect(");
    expect(() => read("src/app/start/page.tsx")).toThrow();
    expect(() => read("src/app/start/layout.tsx")).toThrow();
    // The cookie join that let the wizard "continue" from a separate route is
    // gone with the route.
    expect(() => read("src/lib/start-continuation.ts")).toThrow();
  });
});

describe("the public catalogue reader", () => {
  const api = read("src/lib/api.ts");

  it("reads /api/public/catalogue and parses through the ONE catalogue parser", () => {
    const at = api.indexOf("export async function getPublicCatalogueSignedOut(");
    expect(at).toBeGreaterThan(-1);
    const fn = api.slice(at, at + 1000);
    expect(fn).toContain('fetch("/api/public/catalogue")');
    expect(fn).toContain('parsePublicCatalogue(body.channels, "getPublicCatalogueSignedOut")');
    expect(fn).not.toContain("apiCall(");
  });
});
