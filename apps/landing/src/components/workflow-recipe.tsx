interface Primitive {
  name: string;
  provider: string;
  cost: string;
}

export function WorkflowRecipe() {
  const primitives: Primitive[] = [
    { name: "Apollo lead enrichment", provider: "Apollo", cost: "$0.012" },
    { name: "Claude Sonnet 4.6 — email generation", provider: "Anthropic", cost: "$0.018" },
    { name: "Resend send via agency address", provider: "Resend", cost: "$0.004" },
    { name: "AI reply classifier (Haiku)", provider: "Anthropic", cost: "$0.002" },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 shadow-sm max-w-3xl mx-auto">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">
        Workflow recipe
      </div>
      <h3 className="font-mono text-base text-gray-900 mb-1">sales-outreach · apex-v4</h3>
      <p className="text-xs text-gray-500 mb-6">
        Each workflow stacks priced API primitives. One run = sum of primitives.
        The same outcome can be reached by many recipes — the cheapest one wins.
      </p>

      <div className="space-y-2 mb-6">
        {primitives.map((p, idx) => (
          <div
            key={p.name}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100"
          >
            <span className="w-6 h-6 rounded-md bg-white border border-gray-200 text-[10px] font-mono text-gray-500 flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{p.name}</p>
              <p className="text-[11px] text-gray-400">{p.provider}</p>
            </div>
            <span className="text-sm font-mono text-gray-700 tabular-nums">{p.cost}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-3 rounded-lg bg-cyan-50 border border-cyan-200">
        <div>
          <p className="text-xs text-cyan-700 uppercase tracking-wider font-medium">
            Avg per email
          </p>
          <p className="text-lg font-semibold text-gray-900 font-mono">$0.036</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-cyan-700 uppercase tracking-wider font-medium">
            Avg $/qualified reply
          </p>
          <p className="text-lg font-semibold text-gray-900 font-mono">$1.42</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Every primitive priced publicly. Fork the workflow. Beat the recipe.
      </p>
    </div>
  );
}
