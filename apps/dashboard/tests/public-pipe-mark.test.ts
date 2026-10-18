import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPublicCatalogueSignedOut } from "../src/lib/api";
import { campaignNameFor, legCatalogueFromWire, pipeFor } from "../src/lib/legs";

/**
 * Owner 2026-10-18: « les pipes ont maintenant leur nom et leur logo ». features-service
 * v0.179.264 serves each (channel, leg)'s PIPE (id, name, icon, colour) on the PUBLIC
 * catalogue, so customer surfaces draw the served mark instead of a letter face.
 */
const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const BODY = {
  steps: [{ key: "lead_found", label: "Lead found" }, { key: "positive_reply", label: "Positive reply" }],
  channels: [
    {
      slug: "sales-cold-email-outreach",
      stepTransitions: [
        {
          legKey: "lead_found_to_positive_reply",
          from: { key: "lead_found" },
          to: { key: "positive_reply" },
          campaignName: "Dotterel",
          pipe: { id: "sales-cold-email-outreach|lead_found_to_positive_reply", name: "Dotterel", icon: "bird", color: "#4f46e5" },
        },
        // A leg the producer has no pipe row for.
        { legKey: "lead_found_to_website_visit", from: { key: "lead_found" }, to: { key: "website_visit" }, campaignName: "Killdeer", pipe: null },
      ],
    },
    // A producer older than the field: no `pipe` key at all.
    { slug: "older", stepTransitions: [{ legKey: "lead_found_to_positive_reply", from: { key: "lead_found" }, to: { key: "positive_reply" } }] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("the public catalogue serves each pipe's name and mark", () => {
  it("the reader keeps `pipe`, accepts null and an absent key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ channels: BODY }), { status: 200 })));
    const parsed = await getPublicCatalogueSignedOut();
    const [served, none] = parsed.channels[0].stepTransitions ?? [];
    expect(served.pipe).toEqual({ id: "sales-cold-email-outreach|lead_found_to_positive_reply", name: "Dotterel", icon: "bird", color: "#4f46e5" });
    expect(none.pipe).toBeNull();
    expect(parsed.channels[1].stepTransitions?.[0].pipe).toBeUndefined();
  });

  it("the leg catalogue looks a pipe up by (channel, leg), under either outbound spelling", () => {
    const catalogue = legCatalogueFromWire(BODY);
    const pipe = { id: "sales-cold-email-outreach|lead_found_to_positive_reply", name: "Dotterel", icon: "bird", color: "#4f46e5" };
    expect(pipeFor(catalogue, "sales-cold-email-outreach", "lead_found_to_positive_reply")).toEqual(pipe);
    expect(catalogue.pipes.get("sales-cold-email-outreach|lead_found_to_positive_reply")).toEqual(pipe);
    expect(pipeFor(catalogue, "sales-cold-email-outreach", "lead_found_to_website_visit")).toBeNull();
    expect(pipeFor(catalogue, "older", "lead_found_to_positive_reply")).toBeNull();
    expect(pipeFor(catalogue, null, "x")).toBeNull();
  });

  it("a pipe is named by its served pipe name, the older campaignName only where no pipe is served", () => {
    const body = structuredClone(BODY);
    // Most legs serve a pipe name and no campaignName (prod 2026-10-18: 59 of 93).
    delete (body.channels[0].stepTransitions[0] as { campaignName?: string }).campaignName;
    const catalogue = legCatalogueFromWire(body);
    expect(campaignNameFor(catalogue, "sales-cold-email-outreach", "lead_found_to_positive_reply")).toBe("Dotterel");
    expect(campaignNameFor(catalogue, "sales-cold-email-outreach", "lead_found_to_website_visit")).toBe("Killdeer");
    expect(campaignNameFor(catalogue, "older", "lead_found_to_positive_reply")).toBeNull();
  });

  it("customer surfaces draw the served pipe mark, never the letter face", () => {
    for (const f of ["today-page.tsx", "outcomes-page.tsx", "v2-shell.tsx", "campaign-page.tsx", "offer-campaigns.tsx", "offer-sources-tab.tsx"]) {
      const src = read(`src/components/v2/${f}`);
      expect(src, f).toContain("<ServedPipeMark pipeId={");
      expect(src, f).not.toMatch(/<(Served)?PipeFace\b|<PathAvatar\b/);
    }
  });

  it("the mark reads the PUBLIC catalogue (one source for customer and staff), never the staff one", () => {
    const mark = read("src/components/v2/served-pipe-mark.tsx");
    expect(mark).toContain("usePublicPipe(pipeId)");
    expect(mark).not.toContain("useStaffCatalogueObject");
    expect(mark).not.toMatch(/export function (Served)?PipeFace/);
    // A pipe served with no mark is the catalogue mark's unknown circle: no colour of ours.
    expect(mark).toContain('<CatalogueMark name="" size={size} />');
  });
});
