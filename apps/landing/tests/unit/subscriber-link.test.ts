import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The landing's newsletter-link capture is the dashboard's module, copied byte for
 * byte (apps/dashboard/src/lib/subscriber-link.ts is the source and carries the
 * behaviour tests). Both hosts must park, strip and post a `dy_sub` the same way.
 */
const read = (p: string) => readFileSync(join(__dirname, "../..", p), "utf8");

describe("subscriber-link (newsletter dy_sub)", () => {
  it("is byte-equal to the dashboard module", () => {
    expect(read("src/lib/subscriber-link.ts")).toBe(read("../dashboard/src/lib/subscriber-link.ts"));
  });

  it("every static page and every React page (blog) renders the capture", () => {
    expect(read("src/lib/static-html.ts")).toContain("const subscriberLink = `<script>${SUBSCRIBER_LINK_CAPTURE_SCRIPT}</script>`;");
    expect(read("src/lib/static-html.ts")).toContain("return firstTouch + subscriberLink + ga");
    expect(read("src/app/layout.tsx")).toContain("__html: SUBSCRIBER_LINK_CAPTURE_SCRIPT");
  });

  it("the landing serves the route the script posts to, 204 with no body", () => {
    const route = read("src/app/api/public/subscriber-link/route.ts");
    expect(route).toContain("export async function POST");
    expect(route).toContain("status: 204");
    expect(route).not.toContain("NextResponse.json");
  });
});
