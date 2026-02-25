import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { ApiKeyPreview } from "@/components/api-key-preview";
import { BrandsList } from "@/components/brands-list";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.mcpfactory.org";

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

async function getTopWorkflows(): Promise<LeaderboardWorkflow[]> {
  try {
    const res = await fetch(`${API_URL}/performance/leaderboard`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const workflows: LeaderboardWorkflow[] = data.workflows ?? [];
    return workflows
      .filter((w) => w.costPerReplyCents !== null)
      .sort((a, b) => a.costPerReplyCents! - b.costPerReplyCents!)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function formatCostPerReply(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function DashboardHome() {
  const [user, topWorkflows] = await Promise.all([
    currentUser(),
    getTopWorkflows(),
  ]);

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

      {/* Brands Section */}
      <div className="mb-8">
        <BrandsList />
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

      <div className="mt-8 bg-primary-50 rounded-2xl border border-primary-200 p-6">
        <h3 className="font-display font-bold text-lg text-primary-800 mb-2">Quick Setup</h3>
        <ol className="space-y-2 text-sm text-primary-700">
          <li className="flex items-start gap-2">
            <span className="bg-primary-200 text-primary-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Configure API provider keys in <Link href="/setup" className="underline">Setup</Link></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-primary-200 text-primary-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Create your API key above or in <Link href="/api-keys" className="underline">API Keys</Link></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-primary-200 text-primary-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Use MCP Factory in Claude, Cursor, or any MCP-compatible client</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
