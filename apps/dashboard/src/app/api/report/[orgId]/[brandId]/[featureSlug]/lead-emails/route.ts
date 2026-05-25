import { NextResponse } from "next/server";
import type { LeadEmailSummary } from "@/components/report/leads-table";
import { fetchEmailsForCampaign, fetchWorkflows } from "@/lib/report-api";

// Lazy-fetch endpoint for the public-report leads drawer. The leads page
// itself no longer embeds emails into its server-rendered HTML — that
// dropped a ~15MB / ~25s streaming response down to a small one. The
// drawer client-side fetches this endpoint on first open of each lead;
// the underlying `fetchEmailsForCampaign` is `unstable_cache`-wrapped
// at 4h, so the first hit per (campaignId) pays the upstream cost and
// every later drawer open across all leads of that campaign hits the
// cache.
//
// Match parameters use `firstName + lastName` because the public report
// LeadRow does not carry a lead-service id — only the email + name +
// campaignId. The same key shape that `indexEmailsByLead` previously
// used server-side.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

export async function GET(req: Request, ctx: RouteContext) {
  const { orgId, brandId, featureSlug } = await ctx.params;
  void brandId;
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  const firstName = url.searchParams.get("firstName") ?? "";
  const lastName = url.searchParams.get("lastName") ?? "";

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  const [emails, workflows] = await Promise.all([
    fetchEmailsForCampaign(orgId, brandId, campaignId).catch((err) => {
      console.error(`[report-lead-emails] fetchEmailsForCampaign failed for ${campaignId}:`, err);
      return [];
    }),
    fetchWorkflows(orgId, featureSlug).catch((err) => {
      console.error(`[report-lead-emails] fetchWorkflows failed:`, err);
      return [];
    }),
  ]);

  // Map workflowSlug → display name. taskName on the email's generationRun
  // matches the workflow slug (same convention used by the dropped
  // server-side `indexEmailsByLead`).
  const workflowNameByTask = new Map(workflows.map((w) => [w.workflowSlug, w.workflowDynastyName]));

  const fnLower = firstName.toLowerCase();
  const lnLower = lastName.toLowerCase();
  const matched = emails.filter((e) =>
    (e.leadFirstName ?? "").toLowerCase() === fnLower
    && (e.leadLastName ?? "").toLowerCase() === lnLower,
  );

  const summaries: LeadEmailSummary[] = matched.map((e) => ({
    subject: e.subject ?? "",
    bodyText: e.bodyText ?? "",
    sentAt: e.createdAt,
    workflow: workflowNameByTask.get(e.generationRun?.taskName ?? "") ?? "",
  }));

  summaries.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));

  return NextResponse.json({ emails: summaries });
}
