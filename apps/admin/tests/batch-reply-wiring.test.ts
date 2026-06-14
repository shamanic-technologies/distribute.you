import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Wiring guards for "Reply to all with AI". The behavioural core is unit-tested
// in batch-quote-reply.test.ts; these assert the batch is wired into both
// surfaces AND — the central correctness constraint — that the N-opp loop is
// NEVER pulled into a Route Handler / Server Action (which would run as one
// Vercel serverless function and hit maxDuration). The loop must stay in the
// browser client components.

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf8");

const campaignHitlPage = read(
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/quote-requests/page.tsx",
);
const publicHitlQueue = read("../src/components/report/public-hitl-queue.tsx");
const batchCore = read("../src/lib/batch-quote-reply.ts");
const batchHook = read("../src/lib/use-batch-quote-reply.ts");
const replyRoute = read(
  "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/reply/route.ts",
);
const draftRoute = read(
  "../src/app/api/report/[orgId]/[brandId]/[featureSlug]/draft/route.ts",
);

describe("batch reply — both surfaces host the control", () => {
  it("campaign HITL page renders BatchReplyControl + runs the batch hook", () => {
    expect(campaignHitlPage).toContain("BatchReplyControl");
    expect(campaignHitlPage).toContain("useBatchQuoteReply");
    expect(campaignHitlPage).toContain("selectEligibleOpportunities");
  });

  it("public report queue renders BatchReplyControl + runs the batch hook", () => {
    expect(publicHitlQueue).toContain("BatchReplyControl");
    expect(publicHitlQueue).toContain("useBatchQuoteReply");
    expect(publicHitlQueue).toContain("selectEligibleOpportunities");
  });

  it("public report queue stays decoupled from the Clerk-authed api client", () => {
    expect(publicHitlQueue).not.toContain('from "@/lib/api"');
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

  it("no Route Handler imports the batch loop (it must never run server-side)", () => {
    // Each /reply and /draft call handles exactly ONE opportunity; the loop
    // over N opps lives in the browser. A Route Handler importing the batch
    // module would mean the whole loop runs in one serverless invocation.
    for (const route of [replyRoute, draftRoute]) {
      expect(route).not.toContain("batch-quote-reply");
      expect(route).not.toContain("use-batch-quote-reply");
      expect(route).not.toContain("runBatchReplies");
    }
  });
});

describe("batch reply — /reply route propagates the credit/submittable status", () => {
  it("surfaces upstream 402 + 422 instead of masking every error as 502", () => {
    // Without this, the public-surface 402-stop can't fire (everything was 502).
    expect(replyRoute).toContain("AdminApiError");
    expect(replyRoute).toContain("err.status === 402");
    expect(replyRoute).toContain("err.status === 422");
  });
});
