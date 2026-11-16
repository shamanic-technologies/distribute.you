import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ScriptsMonitoringSchema,
  failedWriters,
  proofBucket,
  proofsByEngine,
  redWriters,
  type WriterProofCombination,
} from "../src/lib/monitoring/scripts-monitoring";

/** PROVEN-BEFORE-PEOPLE-1116: Monitoring > Scripts > Engines shows writer combinations proven / failing per Engine. */

const combo = (over: Partial<WriterProofCombination>): WriterProofCombination => ({
  outcome: "email_sent",
  dynasty: "email_sent/cold-intro",
  version: 3,
  llm: "gemini-3-flash",
  live: true,
  state: "passed",
  usable: 5,
  sample: 5,
  spendAtMostUsd: 0.4,
  provedAt: "2026-11-16T10:00:00.000Z",
  failures: [],
  red: false,
  ...over,
});

const served = {
  since: "2026-10-17",
  outcomes: [],
  writerProofs: {
    engines: [
      { outcome: "email_sent", enforced: false, cases: 100 },
      { outcome: "message_written", enforced: true, cases: "12" },
    ],
    combinations: [
      combo({ dynasty: "email_sent/glm", llm: "glm-5.3-flash", state: "failed", red: true, usable: 0, sample: 1, failures: ["body is the label \"M3\", not an email"] }),
      combo({ dynasty: "email_sent/old", live: false, state: "failed", red: false, failures: ["subject empty"] }),
      combo({ dynasty: "email_sent/new", state: "unproven", usable: 0, sample: 0, provedAt: null, spendAtMostUsd: null }),
      combo({ dynasty: "email_sent/busy", state: "running" }),
      combo({ outcome: "message_written", dynasty: "message_written/a", state: "no_cases" }),
      combo({ outcome: "message_written", dynasty: "message_written/b", state: "passed" }),
    ],
  },
};

describe("writer proofs reader", () => {
  it("parses the served shape (counts coerced) and keeps an absent field absent", () => {
    const p = ScriptsMonitoringSchema.parse(served);
    expect(p.writerProofs?.engines[1].cases).toBe(12);
    expect(ScriptsMonitoringSchema.parse({ since: "x", outcomes: [] }).writerProofs).toBeUndefined();
  });

  it("is red ONLY on the served red (a live failed combination)", () => {
    const wp = ScriptsMonitoringSchema.parse(served).writerProofs!;
    expect(redWriters(wp).map((c) => c.dynasty)).toEqual(["email_sent/glm"]);
    expect(redWriters({ engines: [], combinations: [combo({ state: "error" }), combo({ state: "no_cases" }), combo({ state: "running" })] })).toEqual([]);
  });

  it("buckets: failed but not live is held, every not-yet state stays calm", () => {
    expect(proofBucket(combo({ state: "failed", red: true }))).toBe("failing");
    expect(proofBucket(combo({ state: "failed", live: false }))).toBe("failedOff");
    expect(proofBucket(combo({ state: "running" }))).toBe("running");
    for (const state of ["unproven", "no_cases", "error", "abandoned"]) expect(proofBucket(combo({ state }))).toBe("notYet");
    expect(proofBucket(combo({ state: "passed" }))).toBe("proven");
  });

  it("tallies per Engine, failing Engines first, and names failed combinations live first", () => {
    const wp = ScriptsMonitoringSchema.parse(served).writerProofs!;
    const rows = proofsByEngine(wp);
    expect(rows[0].outcome).toBe("email_sent");
    expect(rows[0].counts).toEqual({ proven: 0, failing: 1, failedOff: 1, running: 1, notYet: 1 });
    expect(rows[1]).toMatchObject({ outcome: "message_written", enforced: true, cases: 12, total: 2 });
    expect(failedWriters(wp).map((c) => c.dynasty)).toEqual(["email_sent/glm", "email_sent/old"]);
  });
});

describe("writer proofs on the Monitoring page", () => {
  const page = readFileSync(join(__dirname, "../src/components/v2/monitoring-page.tsx"), "utf8");
  const view = readFileSync(join(__dirname, "../src/components/v2/monitoring-writer-proofs.tsx"), "utf8");

  it("renders the chart on the Scripts > Engines page and its red tile on the hub", () => {
    expect(page).toContain("<WriterProofsSection />");
    expect(page).toContain('<WriterProofsTile href={href("scripts/engines")} />');
    expect(page).toContain("scriptsBroken?.length || writersRed?.length");
  });

  it("names each failed combination by script + LLM + the first served failure line", () => {
    expect(view).toContain('<CatalogueName kind="llm" name={c.llm} variant="chip" />');
    expect(view).toContain("c.failures[0]");
  });
});
