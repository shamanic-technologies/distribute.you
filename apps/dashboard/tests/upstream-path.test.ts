import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pathSegmentRefusal, upstreamV1Url } from "../src/lib/upstream-path";

/**
 * SECRETS-ROTATE-1127: `GET /api/v1/..%2f..%2finternal/admin/services/<svc>/tables/<t>/rows`
 * escaped /v1 through the proxy and read staff-only tables with the platform key.
 * Whatever the browser sends, the proxy reaches `${API}/v1/<sanitised path>` or nothing.
 */

const API = "https://api.distribute.you";

/** What Next hands a catch-all route: the path split on `/`, each segment decoded ONCE. */
function nextSegments(rawPath: string): string[] {
  return rawPath.split("/").map((s) => decodeURIComponent(s));
}

describe("upstreamV1Url refuses every traversal variant", () => {
  const attacks: [string, string][] = [
    ["..%2f encoded slash", "..%2f..%2finternal/admin/services"],
    ["..%2F upper-case", "..%2F..%2Finternal/admin/services"],
    ["%2e%2e/ encoded dots", "%2e%2e/%2e%2e/internal/admin/services"],
    ["%2E%2e mixed case dots", "%2E%2e/internal/admin"],
    [".%2e half encoded", ".%2e/internal"],
    ["..%5c backslash", "..%5c..%5cinternal/admin"],
    ["%5C upper-case backslash", "brands%5C..%5C..%5Cinternal"],
    ["%252e%252e double-encoded dots", "%252e%252e/%252e%252e/internal/admin"],
    ["%252f double-encoded slash", "..%252f..%252finternal/admin"],
    ["%25252e triple-encoded", "%25252e%25252e/internal"],
    ["plain ..", "../../internal/admin/services"],
    ["plain .", "./internal"],
    ["//host protocol-relative", "/evil.example.com/x"],
    ["absolute URL", "https://evil.example.com/x"],
    ["NUL byte", "brands%00/x"],
  ];
  for (const [label, raw] of attacks) {
    it(`refuses ${label}`, () => {
      const result = upstreamV1Url(API, nextSegments(raw));
      expect(result.ok).toBe(false);
    });
  }

  it("refuses an empty or absent path", () => {
    expect(upstreamV1Url(API, []).ok).toBe(false);
    expect(upstreamV1Url(API, undefined).ok).toBe(false);
  });

  it("refuses the exact prod attack segment Next produced", () => {
    expect(pathSegmentRefusal("../../internal")).not.toBeNull();
    expect(pathSegmentRefusal("..")).toBe("dot segment");
    // A segment Next could not decode reaches us raw; a stray `%` is refused.
    expect(pathSegmentRefusal("%E0%A4%A")).toBe("percent sign after decoding");
    expect(pathSegmentRefusal("50%off")).toBe("percent sign after decoding");
    expect(pathSegmentRefusal("..\\internal")).not.toBeNull();
  });
});

describe("upstreamV1Url keeps normal dashboard calls working", () => {
  it("builds /v1/<path> on the gateway origin", () => {
    const r = upstreamV1Url(API, ["brands", "123e4567-e89b-12d3-a456-426614174000", "offers"]);
    expect(r.ok && r.url.toString()).toBe(
      "https://api.distribute.you/v1/brands/123e4567-e89b-12d3-a456-426614174000/offers",
    );
  });

  it("carries the query string", () => {
    const r = upstreamV1Url(API, ["leads"], new URLSearchParams("brandId=b1&pricing=net"));
    expect(r.ok && r.url.toString()).toBe("https://api.distribute.you/v1/leads?brandId=b1&pricing=net");
  });

  it("keeps an email path segment literal (google accounts)", () => {
    const r = upstreamV1Url(API, nextSegments("orgs/google/accounts/kevin%40example.com"));
    expect(r.ok && r.url.pathname).toBe("/v1/orgs/google/accounts/kevin@example.com");
  });

  it("refuses the double-encoded forms WHATWG would turn into `..` (FORENSICS-1127)", () => {
    // What Next hands us after its one decode of `%252e%252e`, `.%252e`, `%252e.`.
    for (const seg of ["%2e%2e", "%2E%2e", ".%2e", "%2e.", "%2e", "%2f", "%5c", "%25"]) {
      expect(pathSegmentRefusal(seg)).toBe("percent sign after decoding");
      expect(upstreamV1Url(API, [seg, seg, "internal", "admin", "services"]).ok).toBe(false);
    }
  });

  it("encodes spaces, ? and # inside a segment instead of truncating the path", () => {
    const r = upstreamV1Url(API, ["faces", "a b?c#d.svg"]);
    expect(r.ok && r.url.pathname).toBe("/v1/faces/a%20b%3Fc%23d.svg");
  });

  it("keeps dotted names that are not dot segments", () => {
    const r = upstreamV1Url(API, ["public", "catalogue", "faces", "name.v2.svg"]);
    expect(r.ok && r.url.pathname).toBe("/v1/public/catalogue/faces/name.v2.svg");
    expect(upstreamV1Url(API, ["x", "..."]).ok).toBe(true);
  });

  it("ignores any path on the base and stays on its origin", () => {
    const r = upstreamV1Url("http://api-service:8080/whatever", ["me"]);
    expect(r.ok && r.url.toString()).toBe("http://api-service:8080/v1/me");
  });
});

describe("every forwarding route builds its URL through upstreamV1Url", () => {
  const app = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
  const routes = [
    "src/app/(authed)/api/v1/[...path]/route.ts",
    "src/app/api/anon/v1/[...path]/route.ts",
  ];
  for (const route of routes) {
    it(`${route} fetches upstream.url, never a re-joined path`, () => {
      const src = app(route);
      expect(src).toContain("upstreamV1Url(API_URL, ");
      expect(src).toContain("status: 400");
      expect(src).not.toMatch(/new URL\(`\/v1/);
    });
  }

  it("the twins stay byte-equal across dashboard, admin, landing", () => {
    const mine = app("src/lib/upstream-path.ts");
    expect(readFileSync(join(__dirname, "../../admin/src/lib/upstream-path.ts"), "utf8")).toBe(mine);
    expect(readFileSync(join(__dirname, "../../landing/src/lib/upstream-path.ts"), "utf8")).toBe(mine);
  });

  it("the admin catch-all uses it too", () => {
    const src = readFileSync(join(__dirname, "../../admin/src/app/(authed)/api/v1/[...path]/route.ts"), "utf8");
    expect(src).toContain("upstreamV1Url(API_URL, ");
    expect(src).not.toMatch(/new URL\(`\/v1/);
  });
});
