import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The /api/v1 proxy must STREAM the upstream body, never buffer it.
// `await res.text()` held every payload twice (JS string + the re-encoded
// NextResponse body), which OOM-killed the Vercel function instance on large list
// responses (GET /v1/emails returns every email with bodyHtml/bodyText + the full
// generationRun cost tree). Under fluid compute one instance serves several
// concurrent invocations, so the kill also 500'd whatever else was in flight —
// a long-running POST /v1/brands/extract-fields (the offer-levers "Prefill from
// services" button) died that way and the client surfaced Vercel's HTML error
// page as "API returned a non-JSON response".
const proxyPath = path.resolve(
  __dirname,
  "../src/app/(authed)/api/v1/[...path]/route.ts",
);

const adminApiPath = path.resolve(__dirname, "../src/lib/api.ts");
const queryOptionsPath = path.resolve(__dirname, "../src/lib/query-options.ts");
const srcDir = path.resolve(__dirname, "../src");

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findTsFiles(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

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
  const content = fs.readFileSync(adminApiPath, "utf-8");

  it("puts the HTTP status and body preview in the thrown message", () => {
    expect(content).toContain("API returned a non-JSON response (HTTP ${response.status}");
    expect(content).toContain("${preview ? `: ${preview}` : \"\"}");
  });
});

describe("single 30s poll cadence", () => {
  it("query-options exports a 30s POLL_INTERVAL", () => {
    const content = fs.readFileSync(queryOptionsPath, "utf-8");
    expect(content).toContain("export const POLL_INTERVAL = 30_000;");
  });

  it("has no 5s refetchInterval left anywhere in src", () => {
    const violations = findTsFiles(srcDir).filter((file) => {
      const content = fs.readFileSync(file, "utf-8");
      return /refetchInterval:\s*5_?000\b/.test(content);
    });
    expect(violations).toEqual([]);
  });
});
