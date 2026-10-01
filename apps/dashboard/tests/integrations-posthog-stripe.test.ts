import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INTEGRATIONS, integrationFor, missingFields } from "../src/lib/integrations";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("PostHog and Stripe are integrations a brand can connect", () => {
  it("lists them after GoHighLevel", () => {
    expect(INTEGRATIONS.map((i) => i.slug)).toEqual(["gohighlevel", "posthog", "stripe"]);
  });

  it("asks PostHog for the key, the project and the region (a closed choice)", () => {
    const def = integrationFor("posthog")!;
    expect(def.fields.map((f) => f.key)).toEqual(["token", "projectId", "region"]);
    expect(def.fields.find((f) => f.key === "region")!.options!.map((o) => o.value)).toEqual(["eu", "us"]);
    expect(missingFields(def, { token: "phx_1", projectId: "171095" }).map((f) => f.key)).toEqual(["region"]);
    expect(missingFields(def, { projectId: "171095", region: "eu" }, { credentialStored: true })).toEqual([]);
  });

  it("asks Stripe for a restricted key only", () => {
    const def = integrationFor("stripe")!;
    expect(def.fields.map((f) => f.key)).toEqual(["token"]);
    expect(def.fields[0].label).toBe("Restricted key");
  });

  it("links both to Conversations, GoHighLevel to its CRM", () => {
    expect(integrationFor("posthog")!.surfaceHref("o", "b")).toBe("/v2/orgs/o/brands/b/integrations/conversations");
    expect(integrationFor("stripe")!.surfaceHref("o", "b")).toBe("/v2/orgs/o/brands/b/integrations/conversations");
    expect(integrationFor("gohighlevel")!.surfaceHref("o", "b")).toBe("/orgs/o/brands/b/crm");
  });
});

describe("wiring", () => {
  it("each row reads its OWN connection, under its own root", () => {
    const card = read("components/settings/brand-integrations-card.tsx");
    expect(card).toContain('root: "crmConnections"');
    expect(card).toContain('root: "posthogConnections"');
    expect(card).toContain('root: "stripeConnections"');
    expect(card).toContain("useAuthQuery([io.root, brandId], () => io.list(brandId))");
    expect(card).toContain("return await io.connect(brandId, values);");
    expect(card).toContain("await io.disconnect(connection, brandId);");
  });

  it("names the brand on the query string of every source call (the gateway reads no body)", () => {
    const api = read("lib/api.ts");
    const at = api.indexOf("export async function listSourceConnections(");
    const block = api.slice(at, api.indexOf("// The three groups are crm-service's own grouping"));
    expect(block.match(/\?brandId=\$\{encodeURIComponent\(brandId\)\}/g)?.length).toBe(3);
  });
});
