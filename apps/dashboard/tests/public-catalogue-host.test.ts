import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The public onboarding reads must resolve the gateway the SAME way the rest of
 * the app does.
 *
 * This shipped once reading an invented `NEXT_PUBLIC_API_URL`. It is set in
 * neither the build env nor the runtime env on the box, so both handlers
 * resolved to nothing and 500'd on every request in production -- the page
 * rendered and every visitor got its "we could not load what we sell" screen.
 * Nothing was red: tsc passed, the suite passed, the build passed, and the name
 * reads as correct.
 */
const ROUTES = [
  "src/app/api/public/catalogue/route.ts",
  "src/app/api/public/channel-returns/route.ts",
];

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("the public onboarding reads resolve the gateway like the rest of the app", () => {
  it("uses the variable the app actually sets, with the same fallback", () => {
    for (const r of ROUTES) {
      const src = read(r);
      expect(src).toContain("process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL");
      expect(src).toContain('"https://api.distribute.you"');
    }
  });

  it("reads no OTHER api-host variable, however plausible the name", () => {
    for (const r of ROUTES) {
      const names = [...read(r).matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
      expect(names).toEqual(names.filter((n) => n === "NEXT_PUBLIC_DISTRIBUTE_API_URL"));
    }
  });

  it("RETURNS a response on every branch, and actually performs its reads", () => {
    // A handler whose body was gutted still typechecks: an async function with
    // no return infers Promise<void>, so tsc, the suite and the build are all
    // silent while Next answers 500 on every request with
    // "No response is returned from route handler". That shipped, twice, from a
    // scripted edit whose regex over-matched. Assert the body does the work.
    for (const r of ROUTES) {
      const src = read(r);
      const body = src.slice(src.indexOf("export async function GET"));
      expect(body).toContain("return NextResponse.json");
      expect(body.split("return NextResponse.json").length - 1).toBeGreaterThanOrEqual(2);
      // It must actually go upstream: directly, or through this file's own
      // reader helper, which is where the host lives for the catalogue.
      expect(/readPublic\(|fetch\(/.test(body)).toBe(true);
      // No path out of the handler that falls off the end.
      expect(body.replace(/\s/g, "")).not.toContain("GET(){}");
      expect(body.replace(/\s/g, "")).not.toContain("GET(request:Request){}");
    }
  });

  it("matches what lib/api.ts resolves, so the two cannot drift", () => {
    const api = read("src/lib/api.ts");
    expect(api).toContain(
      'process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you"',
    );
  });
});
