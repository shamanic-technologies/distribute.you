interface PortfolioRow {
  product: string;
  spend: string;
  sent: number;
  qualifiedReplies: number;
  costPerReply: string;
  status: "scale" | "watch" | "kill";
}

const STATUS_BADGE: Record<PortfolioRow["status"], { label: string; classes: string; dot: string }> = {
  scale: {
    label: "scale",
    classes: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  watch: {
    label: "watch",
    classes: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-400",
  },
  kill: {
    label: "kill",
    classes: "text-red-400 bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
};

export function PortfolioDashboard() {
  const products: PortfolioRow[] = [
    { product: "mailmesh.com", spend: "$34", sent: 82, qualifiedReplies: 12, costPerReply: "$2.83", status: "scale" },
    { product: "voiceform.io", spend: "$35", sent: 61, qualifiedReplies: 4, costPerReply: "$8.75", status: "watch" },
    { product: "linearclone.dev", spend: "$34", sent: 74, qualifiedReplies: 1, costPerReply: "$34.00", status: "kill" },
    { product: "prompthub.ai", spend: "$34", sent: 88, qualifiedReplies: 22, costPerReply: "$1.55", status: "scale" },
  ];

  return (
    <div className="relative mx-auto max-w-5xl">
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

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800/60 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">Your products</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Last 7 days · Sales outreach across portfolio
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-gray-400 border border-gray-700 rounded-md px-3 py-1.5 hover:text-white hover:border-gray-500 transition"
          >
            + Add product
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-900/40">
              <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                <th className="text-left font-medium px-6 py-3">Product</th>
                <th className="text-right font-medium px-3 py-3">Spend</th>
                <th className="text-right font-medium px-3 py-3 hidden sm:table-cell">Sent</th>
                <th className="text-right font-medium px-3 py-3">Qualified replies</th>
                <th className="text-right font-medium px-3 py-3">$/qual reply</th>
                <th className="text-right font-medium px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {products.map((row) => {
                const badge = STATUS_BADGE[row.status];
                return (
                  <tr key={row.product} className="hover:bg-gray-900/30 transition">
                    <td className="px-6 py-3 font-mono text-white">{row.product}</td>
                    <td className="text-right px-3 py-3 text-gray-300">{row.spend}</td>
                    <td className="text-right px-3 py-3 text-gray-400 hidden sm:table-cell">
                      {row.sent}
                    </td>
                    <td className="text-right px-3 py-3 text-gray-200 font-medium">
                      {row.qualifiedReplies}
                    </td>
                    <td
                      className={`text-right px-3 py-3 font-medium tabular-nums ${
                        row.status === "kill"
                          ? "text-red-400"
                          : row.status === "watch"
                            ? "text-amber-300"
                            : "text-emerald-300"
                      }`}
                    >
                      {row.costPerReply}
                    </td>
                    <td className="text-right px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider font-medium ${badge.classes}`}
                      >
                        <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-gray-800/60 bg-gray-900/30 text-[10px] text-gray-500 flex items-center justify-between">
          <span>4 products · $137 spent · 39 qualified replies · avg CAC $3.51</span>
          <span className="text-gray-600">Updated 12s ago</span>
        </div>
      </div>

      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-emerald-500/10 rounded-2xl blur-3xl -z-10" />
    </div>
  );
}
