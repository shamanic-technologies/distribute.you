import { NextResponse, type NextRequest } from "next/server";
import { fetchEmails, fetchWorkflows } from "@/lib/report-api";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface EmailLite {
  campaignId: string;
  leadFirstName: string;
  leadLastName: string;
  subject: string;
  bodyText: string;
  sentAt: string;
  workflow: string;
}

/** Public proxy for the report's drawer. Returns the brand's emails as a
 *  slim list (no FullLead, no run cost tree, no bodyHtml) so the leads
 *  page can lazy-fetch them when the user opens the right drawer. One
 *  call per brand × session — the client caches the response. */
export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ orgId: string; brandId: string }> },
) {
  void req;
  const { orgId, brandId } = await segmentData.params;

  // featureSlug isn't needed for the emails endpoint — emails are scoped
  // by brandId. fetchWorkflows requires it though; use a sentinel so we
  // get all workflows for the brand (the function filters by featureSlug
  // server-side, which means we get the union we need).
  const featureSlug = req.nextUrl.searchParams.get("featureSlug") ?? "";
  // Optional campaignId filter — when provided, the proxy fetches only that
  // campaign's emails instead of all brand emails. The drawer-open path
  // passes the selected row's campaignId so each fetch is small enough to
  // beat the 25s upstream abort. Without it we'd time out on brands with
  // many campaigns.
  const campaignId = req.nextUrl.searchParams.get("campaignId") ?? undefined;

  const startedAt = Date.now();
  try {
    const [emails, workflows] = await Promise.all([
      fetchEmails(orgId, brandId, campaignId),
      featureSlug
        ? fetchWorkflows(orgId, featureSlug).catch(() => [])
        : Promise.resolve([]),
    ]);
    const workflowNameByTask = new Map<string, string>();
    for (const w of workflows) {
      workflowNameByTask.set(w.workflowSlug, w.workflowDynastyName);
    }
    const slim: EmailLite[] = emails.map((e) => {
      const taskName = e.generationRun?.taskName ?? "";
      return {
        campaignId: e.campaignId,
        leadFirstName: e.leadFirstName,
        leadLastName: e.leadLastName,
        subject: e.subject,
        bodyText: e.bodyText ?? "",
        sentAt: e.createdAt,
        workflow: workflowNameByTask.get(taskName) ?? taskName ?? "",
      };
    });
    const elapsed = Date.now() - startedAt;
    console.log(`[dashboard-report] emails ${orgId}/${brandId}${campaignId ? `/${campaignId}` : ""} → ${slim.length} rows in ${elapsed}ms`);
    return NextResponse.json({ emails: slim });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    console.error(`[dashboard-report] /api/public/report/${orgId}/${brandId}/emails${campaignId ? `?campaignId=${campaignId}` : ""} failed after ${elapsed}ms:`, err);
    return NextResponse.json(
      { error: "Upstream emails endpoint failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
