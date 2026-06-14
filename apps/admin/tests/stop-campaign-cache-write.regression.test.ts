import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

describe("useStopCampaign — single-click UI flip (regression)", () => {
  const src = readFileSync(resolve(ROOT, "src/lib/use-stop-campaign.ts"), "utf8");

  // Bug: when GET /campaigns/{id} returns 5xx (api-service flaky), the cached
  // campaign stays "ongoing" after a successful stop because onSuccess only
  // invalidated the query and the refetch failed (keepPreviousData held the
  // stale row). User saw "nothing happens" on first click. Fix: write the
  // returned campaign to the cache directly via setQueryData, so UI flips to
  // "stopped" without depending on the next poll.
  it("onSuccess writes the returned campaign to the [\"campaign\", id] cache", () => {
    expect(src).toMatch(
      /setQueryData\(\s*\[\s*["']campaign["']\s*,\s*campaign\.id\s*\]\s*,\s*data\s*\)/,
    );
  });

  it("onSuccess no longer relies on invalidateQueries for the single-campaign cache", () => {
    expect(src).not.toMatch(
      /invalidateQueries\(\s*\{\s*queryKey:\s*\[\s*["']campaign["']\s*,\s*campaign\.id\s*\]\s*\}\s*\)/,
    );
  });

  it("onSuccess still invalidates the [\"campaigns\"] list cache", () => {
    expect(src).toMatch(
      /invalidateQueries\(\s*\{\s*queryKey:\s*\[\s*["']campaigns["']\s*\]\s*\}\s*\)/,
    );
  });

  it("onSuccess still fires the campaign_stopped notification", () => {
    expect(src).toMatch(/sendCampaignEmail\(\s*["']campaign_stopped["']/);
  });
});
