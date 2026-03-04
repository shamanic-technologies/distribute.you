import type { FeatureColor } from "@distribute/content";

const SIDEBAR_COLORS: Record<FeatureColor, { activeBg: string; activeText: string; dot: string }> = {
  emerald: { activeBg: "bg-emerald-500/10", activeText: "text-emerald-400", dot: "bg-emerald-400" },
  cyan: { activeBg: "bg-cyan-500/10", activeText: "text-cyan-400", dot: "bg-cyan-400" },
  blue: { activeBg: "bg-blue-500/10", activeText: "text-blue-400", dot: "bg-blue-400" },
  violet: { activeBg: "bg-violet-500/10", activeText: "text-violet-400", dot: "bg-violet-400" },
  pink: { activeBg: "bg-pink-500/10", activeText: "text-pink-400", dot: "bg-pink-400" },
  amber: { activeBg: "bg-amber-500/10", activeText: "text-amber-400", dot: "bg-amber-400" },
};

export function DashboardPreview() {
  const features: { name: string; active: boolean; color: FeatureColor }[] = [
    { name: "Welcome Emails", active: true, color: "emerald" },
    { name: "Cold Outreach", active: true, color: "cyan" },
    { name: "Webinar Lifecycle", active: false, color: "blue" },
    { name: "Lifecycle Campaigns", active: false, color: "violet" },
  ];

  const workflows = [
    { rank: 1, name: "aurora-v3", openRate: "34.2%", costPerOpen: "$0.03", bar: 100 },
    { rank: 2, name: "nova-v2", openRate: "31.8%", costPerOpen: "$0.04", bar: 93 },
    { rank: 3, name: "sienna-v1", openRate: "28.5%", costPerOpen: "$0.05", bar: 83 },
    { rank: 4, name: "ember-v2", openRate: "25.1%", costPerOpen: "$0.06", bar: 73 },
    { rank: 5, name: "coral-v1", openRate: "22.7%", costPerOpen: "$0.07", bar: 66 },
  ];

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Browser chrome */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-950 shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-gray-800 rounded-md px-4 py-1 text-xs text-gray-400 font-mono">
              app.distribute.you/dashboard
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="flex min-h-[420px]">
          {/* Sidebar */}
          <div className="w-48 border-r border-gray-800 bg-gray-900/50 p-4 hidden md:block">
            <div className="font-semibold text-white text-sm mb-4 tracking-tight">distribute</div>
            <div className="space-y-1">
              {features.map((f) => {
                const colors = SIDEBAR_COLORS[f.color];
                return (
                  <div
                    key={f.name}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                      f.active
                        ? `${colors.activeBg} ${colors.activeText}`
                        : "text-gray-500"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        f.active ? colors.dot : "bg-gray-600"
                      }`}
                    />
                    {f.name}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-800">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                Account
              </div>
              <div className="text-xs text-gray-500 px-2.5">Settings</div>
              <div className="text-xs text-gray-500 px-2.5 mt-1">API Keys</div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 p-5 md:p-6">
            {/* Feature header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-semibold text-sm">Welcome Emails</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  Best workflow selected automatically
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs px-2.5 py-1 rounded-full border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Active
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Open Rate
                </p>
                <p className="text-xl font-bold text-white mt-1">34.2%</p>
                <p className="text-[10px] text-green-400 mt-0.5">+2.1% vs avg</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Cost / Open
                </p>
                <p className="text-xl font-bold text-white mt-1">$0.03</p>
                <p className="text-[10px] text-green-400 mt-0.5">-18% vs avg</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Emails Sent
                </p>
                <p className="text-xl font-bold text-white mt-1">12.8k</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Last 30 days</p>
              </div>
            </div>

            {/* Workflow leaderboard */}
            <div className="bg-gray-800/30 rounded-lg border border-gray-700/30 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700/30">
                <p className="text-xs font-medium text-gray-300">
                  Workflow Leaderboard
                </p>
              </div>
              <div className="divide-y divide-gray-800/50">
                {workflows.map((wf) => (
                  <div
                    key={wf.rank}
                    className={`flex items-center gap-3 px-4 py-2 text-xs ${
                      wf.rank === 1 ? "bg-emerald-500/5" : ""
                    }`}
                  >
                    <span
                      className={`w-5 text-center font-mono ${
                        wf.rank === 1
                          ? "text-emerald-400 font-bold"
                          : "text-gray-600"
                      }`}
                    >
                      {wf.rank}
                    </span>
                    <span
                      className={`w-20 font-mono ${
                        wf.rank === 1 ? "text-white" : "text-gray-400"
                      }`}
                    >
                      {wf.name}
                    </span>
                    <div className="flex-1">
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            wf.rank === 1
                              ? "bg-emerald-400"
                              : "bg-gray-600"
                          }`}
                          style={{ width: `${wf.bar}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-12 text-right text-gray-400">
                      {wf.openRate}
                    </span>
                    <span className="w-12 text-right text-gray-500">
                      {wf.costPerOpen}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect behind dashboard — rainbow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 via-violet-500/10 to-pink-500/10 rounded-2xl blur-3xl -z-10" />
    </div>
  );
}
