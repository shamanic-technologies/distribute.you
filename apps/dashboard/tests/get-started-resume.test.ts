import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GET_STARTED_RESUME_MAX_AGE_MS,
  firstOpenStepIndex,
  parseGetStartedSnapshot,
  snapshotResumable,
} from "../src/lib/v2/get-started";

const NOW = Date.UTC(2026, 9, 5, 12);
const base = {
  version: 2,
  website: "https://home.cern",
  brandId: "brand-1",
  brandName: "CERN",
  domain: "home.cern",
  overview: "",
  facts: [],
  competitors: [],
  offer: null,
  audience: null,
  budgetUsd: null,
  email: null,
};

describe("/get-started resumes a walk after a reload or a new tab", () => {
  it("keeps when the snapshot was saved", () => {
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, savedAt: NOW }))?.savedAt).toBe(NOW);
  });

  it("resumes a fresh snapshot, never one older than the anonymous session", () => {
    const fresh = parseGetStartedSnapshot(JSON.stringify({ ...base, savedAt: NOW - 60_000 }))!;
    const stale = parseGetStartedSnapshot(JSON.stringify({ ...base, savedAt: NOW - GET_STARTED_RESUME_MAX_AGE_MS - 1 }))!;
    const undated = parseGetStartedSnapshot(JSON.stringify(base))!;
    expect(snapshotResumable(fresh, NOW)).toBe(true);
    expect(snapshotResumable(stale, NOW)).toBe(false);
    expect(snapshotResumable(undated, NOW)).toBe(false);
  });

  it("lands on the first step not done", () => {
    expect(firstOpenStepIndex(["done", "done", "choose", "failed"])).toBe(2);
    expect(firstOpenStepIndex(["done", "done"])).toBe(1);
  });

  it("the snapshot lives in localStorage (survives a reload and a new tab), on both its writers", () => {
    const gs = readFileSync("src/components/v2/get-started/get-started.tsx", "utf8");
    const wall = readFileSync("src/components/v2/get-started/account-card-wall.tsx", "utf8");
    expect(gs).not.toMatch(/sessionStorage\.(get|set)Item\(GET_STARTED_SNAPSHOT_KEY/);
    expect(gs).toContain("localStorage.getItem(GET_STARTED_SNAPSHOT_KEY)");
    expect(gs).toContain("localStorage.setItem(GET_STARTED_SNAPSHOT_KEY");
    expect(wall).toContain("localStorage.removeItem(GET_STARTED_SNAPSHOT_KEY)");
  });

  it("a plain reload resumes (not only the Google round trip), and re-asks what was still being prepared", () => {
    const gs = readFileSync("src/components/v2/get-started/get-started.tsx", "utf8");
    expect(gs).toContain("snapshotResumable(snap, Date.now())");
    // Never re-asked for a signed-in visitor: that would bill their active org.
    expect(gs).toContain("if (!snap || isSignedIn !== false) return;");
    expect(gs).toContain("resumePreparing(");
  });
});
