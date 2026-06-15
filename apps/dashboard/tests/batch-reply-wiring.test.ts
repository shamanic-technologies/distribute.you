import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Wiring guards for "Reply to all with AI". The behavioural core is unit-tested
// in batch-quote-reply.test.ts; these assert the batch is wired into the campaign
// HITL surface AND — the central correctness constraint — that the N-opp loop is
// NEVER pulled into a Route Handler / Server Action (which would run as one
// Vercel serverless function and hit maxDuration). The loop must stay in the
// browser client components.

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf8");

const campaignHitlPage = read(
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/quote-requests/page.tsx",
);
const batchCore = read("../src/lib/batch-quote-reply.ts");
const batchHook = read("../src/lib/use-batch-quote-reply.ts");

describe("batch reply — the campaign HITL surface hosts the control", () => {
  it("campaign HITL page renders BatchReplyControl + runs the batch hook", () => {
    expect(campaignHitlPage).toContain("BatchReplyControl");
    expect(campaignHitlPage).toContain("useBatchQuoteReply");
    expect(campaignHitlPage).toContain("selectEligibleOpportunities");
  });
});

describe("batch reply — loop is client-side only (no Vercel-timeout wrapper)", () => {
  it("the loop core + hook are client modules (the hook is 'use client')", () => {
    expect(batchHook.trimStart().startsWith('"use client"')).toBe(true);
    // The pure core must not import React or any server-only api module — it is
    // a framework-agnostic loop, unit-tested in isolation.
    expect(batchCore).not.toContain('from "react"');
    expect(batchCore).not.toContain("server-only");
  });
});
