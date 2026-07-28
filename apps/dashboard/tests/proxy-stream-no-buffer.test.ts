import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The /api/v1 proxy must STREAM the upstream body, never buffer it. Reading the
// body into a string first held every payload twice (the JS string + the
// re-encoded NextResponse body), which OOM-killed the Vercel function instance on
// large list responses. Under fluid compute one instance serves several concurrent
// invocations, so the kill also 500'd whatever else was in flight, and the client
// surfaced Vercel's HTML error page as "API returned a non-JSON response".
const proxyPath = path.resolve(
  __dirname,
  "../src/app/(authed)/api/v1/[...path]/route.ts",
);

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");

describe("api/v1 proxy streams instead of buffering", () => {
  const content = fs.readFileSync(proxyPath, "utf-8");

  it("returns the upstream stream body", () => {
    expect(content).toContain("new NextResponse(res.body, {");
  });

  it("never buffers the upstream body with await res.text()", () => {
    expect(content).not.toContain("await res.text()");
  });
});

describe("non-JSON API error carries diagnostics", () => {
  const content = fs.readFileSync(apiPath, "utf-8");

  it("puts the HTTP status and body preview in the thrown message", () => {
    expect(content).toContain("API returned a non-JSON response (HTTP ${response.status}");
    expect(content).toContain("${preview ? `: ${preview}` : \"\"}");
  });
});
