import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The CRM connect and disconnect must name the brand in their QUERY STRING.
 *
 * crm-service opens its own run in runs-service BEFORE the route handler is
 * reached, and it builds that run's brand list from the `x-brand-id` identity
 * header. The api-service gateway fills that header from a request header or a
 * query param and from nothing else: a body is never read for it. runs-service
 * then refuses a run whose brand list is present and empty, crm-service turns
 * that refusal into a 502, and the customer reads "We could not reach your CRM
 * just now" on a token nothing ever tried.
 *
 * So the brand in the connect BODY (which is what crm-service's handler reads to
 * know what to connect) is not enough on its own, and the query copy is not a
 * duplicate of it. They answer two different services.
 *
 * This is the second occurrence. distribute.you#2968 fixed the identical 400 on
 * the CSV upload by having that one caller send the brand. crm-service owns the
 * durable fix; these guards keep the customer's button working meanwhile.
 */

const API = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");
const CARD = readFileSync(
  join(process.cwd(), "src/components/settings/brand-integrations-card.tsx"),
  "utf8",
);

/** The body of one declaration, bounded by the next one rather than by a length. */
function sliceBetween(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  expect(a, `opening marker not found: ${from}`).toBeGreaterThan(-1);
  const b = src.indexOf(to, a + from.length);
  expect(b, `closing marker not found: ${to}`).toBeGreaterThan(a);
  return src.slice(a, b);
}

describe("connectCrm names the brand where the gateway can see it", () => {
  const body = sliceBetween(
    API,
    "export async function connectCrm(",
    "export async function disconnectCrm(",
  );

  it("sends brandId on the query string", () => {
    expect(body).toContain("/orgs/gohighlevel/connections?brandId=");
    expect(body).toContain("encodeURIComponent(brandId)");
  });

  it("still sends brandId in the body, which is what crm-service's handler reads", () => {
    expect(body).toContain("body: { brandId, locationId }");
  });

  it("is a POST", () => {
    expect(body).toContain('method: "POST"');
  });
});

describe("disconnectCrm names the brand too", () => {
  const body = sliceBetween(
    API,
    "export async function disconnectCrm(",
    "const CrmContactSchema",
  );

  it("takes the brand, because the connection id alone names no brand", () => {
    expect(body).toContain("brandId: string");
  });

  it("sends it on the query string", () => {
    expect(body).toContain("?brandId=${encodeURIComponent(brandId)}");
  });

  it("is a DELETE", () => {
    expect(body).toContain('method: "DELETE"');
  });
});

describe("the call site passes the brand", () => {
  it("hands disconnectCrm the brand the card is scoped to", () => {
    // A reader perfectly able to carry the brand is the fix entirely absent if
    // the only caller never passes one.
    expect(CARD).toContain("disconnectCrm(connection.id, brandId)");
  });
});
