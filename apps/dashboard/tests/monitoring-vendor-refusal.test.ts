import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OpsInfraSchema, emptySendPools, refusalSentence, sendPoolVendors, sendPoolWord, utcMoment, vendorRefusals, vendorWord } from "../src/lib/monitoring/capacity";

/**
 * SEND-PRIMEFORGE-402-1030: on 2026-10-29 Primeforge answered 402 "active subscription required" and every cold email
 * stopped fleet-wide, with nothing red on Monitoring. instantly-service v0.83.153 now drops only the refusing vendor's
 * mailboxes and serves `vendorRefusals` on the ops infra read Capacity already loads. Non-empty = red on the hub and a
 * card on Capacity; empty or absent (older deploy) = nothing changes.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// CONTRACT-BUILT, not prod-captured: the 2026-10-19 prod body plus one refusal shaped as instantly-service's
// `VendorRefusal` (src/lib/self-send/mailbox-credentials.ts, error = `${status} - ${body}`), before v0.83.153 deployed.
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "ops-infra-vendor-refusal-1030.json"), "utf8"));
const prod = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "ops-infra-prod-2026-10-19.json"), "utf8"));

describe("Capacity: a mailbox vendor refusing us", () => {
  it("parses the served refusal and names the vendor, since when and its answer", () => {
    const infra = OpsInfraSchema.parse(fixture());
    const [r] = vendorRefusals(infra);
    expect(vendorRefusals(infra)).toHaveLength(1);
    expect(vendorWord(r.vendor)).toBe("Primeforge");
    expect(r.error).toBe('402 - {"message":"active subscription required"}');
    expect(refusalSentence(r)).toBe("Primeforge refuses us since Oct 29, 15:02 UTC: its mailboxes send nothing, every other vendor keeps sending.");
    expect(utcMoment(r.lastSeenAt)).toBe("Oct 30, 09:41 UTC");
  });

  it("an empty array or an absent field (older instantly-service) is nothing refused, and still parses", () => {
    expect(vendorRefusals(OpsInfraSchema.parse(prod()))).toEqual([]);
    expect(vendorRefusals(OpsInfraSchema.parse({ ...prod(), vendorRefusals: [] }))).toEqual([]);
  });

  it("an unknown vendor prints as served", () => {
    expect(vendorWord("newforge")).toBe("newforge");
  });

  it("Capacity draws the card above the tiles, only when a refusal is served", () => {
    const src = read("components/v2/monitoring-capacity.tsx");
    const page = src.slice(src.indexOf("export function CapacityPage("));
    expect(page.indexOf("<VendorRefusals />")).toBeGreaterThan(-1);
    expect(page.indexOf("<VendorRefusals />")).toBeLessThan(page.indexOf("<CapacityTiles />"));
    const card = src.slice(src.indexOf("function VendorRefusals("), src.indexOf("export function VendorRefusalTile("));
    expect(card).toContain("if (!refusals.length) return null;");
    expect(card).toContain("{r.error}");
    expect(card).toContain("refusalSentence(r)");
  });

  it("the hub shows a red tile and a red Capacity chip while a vendor refuses, nothing otherwise, never an email", () => {
    const src = read("components/v2/monitoring-capacity.tsx");
    const tile = src.slice(src.indexOf("export function VendorRefusalTile("), src.indexOf("export function CapacityPage("));
    expect(tile).toContain("if (!refusals.length) return null;");
    expect(tile).toContain("color: RED");
    const page = read("components/v2/monitoring-page.tsx");
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub).toContain('<VendorRefusalTile href={href("emails/capacity")} />');
    expect(hub.indexOf("<VendorRefusalTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('color={mailboxVendorsRefusing || sendPoolEmpty ? "var(--data-rose)" : "var(--data-sky)"} label="Capacity"');
  });
});

/**
 * SEND-POOL-VENDOR-402-1030: from 2026-10-29 15:00 UTC every org's new emails were refused for a day while Capacity read
 * "35 addresses in production". instantly-service v0.83.157 serves `sendPools` (the sender's own selection) and keeps a
 * refusing vendor's mailboxes on its last listing. Zero in a pool = red on the hub and a card on Capacity.
 */
describe("Capacity: the send pool", () => {
  const withPools = (sendPools: unknown) => OpsInfraSchema.parse({ ...prod(), sendPools });

  it("a pool at zero is empty, a pool with mailboxes is not, an absent field is no pool", () => {
    expect(emptySendPools(withPools([{ pool: "shared", sendable: 0, byVendor: {} }])).map((p) => p.pool)).toEqual(["shared"]);
    expect(emptySendPools(withPools([{ pool: "shared", sendable: 13, byVendor: { primeforge: 13 } }]))).toEqual([]);
    expect(emptySendPools(OpsInfraSchema.parse(prod()))).toEqual([]);
  });

  it("names who sends and from which vendors, largest first", () => {
    const [p] = withPools([{ pool: "shared", sendable: 15, byVendor: { gandi: 2, primeforge: 13 } }]).sendPools!;
    expect(sendPoolWord(p.pool)).toBe("Every org");
    expect(sendPoolVendors(p)).toBe("13 Primeforge, 2 Gandi");
  });

  it("a refusing vendor sending on its stored list says so", () => {
    const [r] = vendorRefusals(OpsInfraSchema.parse({
      ...fixture(),
      vendorRefusals: [{ ...fixture().vendorRefusals[0], lastListingAt: "2026-10-29T11:22:12.532Z", lastListingMailboxes: 131 }],
    }));
    expect(refusalSentence(r)).toBe("Primeforge refuses us since Oct 29, 15:02 UTC: its 131 mailboxes keep sending on the list it gave us Oct 29, 11:22 UTC.");
  });

  it("the hub tile turns red at zero and Capacity draws the card first, never an email", () => {
    const src = read("components/v2/monitoring-capacity.tsx");
    const tile = src.slice(src.indexOf("export function SendPoolTile("), src.indexOf("export function CapacityPage("));
    expect(tile).toContain("color: RED");
    expect(tile).toContain("emptySendPools(infra.data)");
    const page = src.slice(src.indexOf("export function CapacityPage("));
    expect(page.indexOf("<EmptySendPools />")).toBeGreaterThan(-1);
    expect(page.indexOf("<EmptySendPools />")).toBeLessThan(page.indexOf("<CapacityTiles />"));
    const hub = read("components/v2/monitoring-page.tsx");
    expect(hub).toContain('<SendPoolTile href={href("emails/capacity")} />');
  });
});
