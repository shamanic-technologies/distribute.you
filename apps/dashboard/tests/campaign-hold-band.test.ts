import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
const API = read("lib/api.ts");
const PERSIST = read("lib/persist-cache.ts");

describe("the campaign hold copy", () => {
  it("carries no em-dash in anything a customer reads", () => {
    // Comments are exempt (internal prose); the strings a customer reads are not. So
    // strip every comment first, or the guard fires on the doc block explaining itself.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripComments(read("lib/campaign-hold.ts"))).not.toContain("—");
  });
});

describe("the events reader", () => {
  it("forwards the event filter the gateway accepts", () => {
    const at = API.indexOf("export async function listCampaignEvents");
    const body = API.slice(at, API.indexOf("\n}", at));
    expect(body).toContain('params.set("event"');
    expect(body).toContain('params.set("campaignId"');
    // The org is injected at the gateway from the auth context, never sent from here.
    expect(body).not.toContain('params.set("orgId"');
  });

  it("fails loud on wire-rot rather than rendering an empty hold", () => {
    const at = API.indexOf("export async function listCampaignEvents");
    expect(API.slice(at, API.indexOf("\n}", at))).toContain("invalid response shape");
  });

  it("is allowlisted for the persisted cache, or it cold-fetches every visit", () => {
    expect(PERSIST).toContain('"campaignHold"');
  });
});
