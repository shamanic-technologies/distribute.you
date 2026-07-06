import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("distribute self conversion ping (dogfood)", () => {
  const ping = read("../src/components/conversion-ping.tsx");
  const shared = read("../src/lib/distribute-conversion.ts");
  const tracker = read("../src/components/posthog-auth-tracker.tsx");
  const layout = read("../src/app/(authed)/layout.tsx");

  it("fires a liveness-only ping once per session", () => {
    expect(ping).toContain('body: JSON.stringify({ event: "ping" })');
    expect(ping).toContain("sessionStorage");
    // Liveness only — no identity fields ride the ping.
    expect(ping).not.toContain("email");
    expect(ping).not.toContain("firstName");
    // Fire-and-forget — never blocks the page.
    expect(ping).toContain(".catch(() => {})");
  });

  it("keeps ONE source of the conversion token (no drift)", () => {
    expect(shared).toContain("DISTRIBUTE_CONVERSION_TOKEN");
    expect(shared).toContain("DISTRIBUTE_CONVERSION_INGEST_URL");
    // The signup reporter imports the token, no longer hardcodes it.
    expect(tracker).toContain('from "@/lib/distribute-conversion"');
    expect(tracker).not.toContain('"pk_conv_');
    expect(tracker).not.toContain('"https://api.distribute.you/public/conversions"');
    // Both consumers read the same shared ingest URL constant.
    expect(ping).toContain('from "@/lib/distribute-conversion"');
  });

  it("mounts the ping in the authed layout", () => {
    expect(layout).toContain("<ConversionPing />");
    expect(layout).toContain('import { ConversionPing }');
  });
});
