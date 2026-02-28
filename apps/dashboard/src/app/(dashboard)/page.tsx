import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ApiKeyPreview } from "@/components/api-key-preview";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.distribute.you";

interface LeaderboardWorkflow {
  workflowName: string;
  displayName: string;
  signatureName: string | null;
  category: string | null;
  sectionKey: string | null;
  runCount: number;
  emailsSent: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  replyRate: number;
  costPerReplyCents: number | null;
}

async function getLeaderboardWorkflows(): Promise<LeaderboardWorkflow[]> {
  try {
    const res = await fetch(`${API_URL}/performance/leaderboard`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.workflows ?? []).filter(
      (w: LeaderboardWorkflow) => w.costPerReplyCents !== null
    );
  } catch {
    return [];
  }
}

async function getUserWorkflowNames(token: string): Promise<Set<string>> {
  try {
    const res = await fetch(`${API_URL}/v1/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const names = new Set<string>();
    for (const c of data.campaigns ?? []) {
      if (c.workflowName) names.add(c.workflowName);
    }
    return names;
  } catch {
    return new Set();
  }
}

function pickTopWorkflows(
  allWorkflows: LeaderboardWorkflow[],
  userWorkflowNames: Set<string>
): LeaderboardWorkflow[] {
  const byBestCost = (a: LeaderboardWorkflow, b: LeaderboardWorkflow) =>
    a.costPerReplyCents! - b.costPerReplyCents!;

  // User's workflows first (sorted by cost per reply asc)
  const userWfs = allWorkflows
    .filter((w) => userWorkflowNames.has(w.workflowName))
    .sort(byBestCost);

  if (userWfs.length >= 3) return userWfs.slice(0, 3);

  // Fill remaining slots with top performers the user hasn't used
  const remaining = allWorkflows
    .filter((w) => !userWorkflowNames.has(w.workflowName))
    .sort(byBestCost);

  return [...userWfs, ...remaining].slice(0, 3);
}

function formatCostPerReply(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function DashboardHome() {
  const [user, { getToken }, allWorkflows] = await Promise.all([
    currentUser(),
    auth(),
    getLeaderboardWorkflows(),
  ]);

  const token = await getToken();
  const userWorkflowNames = token
    ? await getUserWorkflowNames(token)
    : new Set<string>();

  const topWorkflows = pickTopWorkflows(allWorkflows, userWorkflowNames);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-gray-600">Select a workflow to get started.</p>
      </div>

      {/* API Key Section */}
      <div className="mb-8 max-w-md">
        <ApiKeyPreview />
      </div>

      {/* Organizations Section */}
      <div className="mb-8">
        <h2 className="font-display text-lg font-bold text-gray-800 mb-4">
          Organizations
        </h2>
        <Link
          href="/orgs"
          className="block bg-white rounded-2xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Organizations</h3>
              <p className="text-sm text-gray-500">Manage your organizations and brands</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Top Workflows by Cost per Reply */}
      {topWorkflows.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-gray-800">
              Top Workflows
            </h2>
            <Link
              href="/workflows"
              className="text-primary-500 hover:text-primary-600 font-medium text-sm"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topWorkflows.map((wf, i) => (
              <div
                key={wf.workflowName}
                className="bg-white rounded-2xl border border-gray-200 p-6 relative overflow-hidden"
              >
                {i === 0 && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                    Best
                  </div>
                )}
                {userWorkflowNames.has(wf.workflowName) && (
                  <div className="absolute top-0 left-0 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-br-xl">
                    Your workflow
                  </div>
                )}
                <div className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">
                  {wf.category ?? "workflow"}
                </div>
                <h3 className="font-display font-bold text-lg text-gray-800 mb-1">
                  {wf.displayName}
                </h3>
                {wf.signatureName && (
                  <p className="text-xs text-gray-400 mb-4">
                    Variant: {wf.signatureName}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">$/Reply</div>
                    <div className="text-xl font-bold text-gray-800">
                      {formatCostPerReply(wf.costPerReplyCents!)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1">Reply Rate</div>
                    <div className="text-xl font-bold text-gray-800">
                      {wf.replyRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{wf.emailsSent.toLocaleString()} sent</span>
                  <span>{wf.emailsReplied.toLocaleString()} replies</span>
                  <span>{wf.runCount} runs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
