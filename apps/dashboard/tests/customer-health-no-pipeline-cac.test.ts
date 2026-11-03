import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ROI-CONSISTENCY-1103 (owner 2026-11-03): a return exists only where a value lands. The
// customer-health "current CAC" is LTR x (spend / pipeline), the pipeline forecast in disguise,
// so neither app reads it (schema, type or screen). `breakevenCacUsd` (= the offer's LTR) stays.
const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

const READERS = [
  "../src/lib/monitoring/monitoring.ts",
  "../src/components/v2/monitoring-accounts.tsx",
  "../../admin/src/lib/api.ts",
  "../../admin/src/components/customer-success-view.tsx",
];

describe("customer-health board: no pipeline-based CAC", () => {
  for (const rel of READERS) {
    it(`${rel} never reads currentCacUsd nor a customer-health cacPct`, () => {
      const src = read(rel);
      expect(src).not.toContain("currentCacUsd");
      expect(src).not.toContain("cacPct");
    });
  }
});
