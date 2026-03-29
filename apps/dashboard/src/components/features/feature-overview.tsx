/* ─── Feature overview panel ─────────────────────────────────────── */

export function FeatureOverview({ feature, registry }: {
  feature: {
    slug: string;
    name: string;
    description: string;
    icon?: string;
    category: string;
    channel: string;
    audienceType: string;
    inputs: Array<{ key: string; label: string; description: string; placeholder?: string; type?: string; extractKey?: string }>;
    outputs: Array<{ key: string; displayOrder?: number }>;
    charts: Array<{ type: string; title: string }>;
    entities: Array<{ name: string; countKey?: string }>;
  };
  registry: Record<string, { label?: string; type?: string }>;
}) {
  return (
    <div className="space-y-5">
      {/* Description */}
      {feature.description && (
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {feature.description}
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-1.5">
        {feature.category && (
          <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
            {feature.category}
          </span>
        )}
        {feature.channel && (
          <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
            {feature.channel}
          </span>
        )}
        {feature.audienceType && (
          <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
            {feature.audienceType}
          </span>
        )}
      </div>

      {/* Inputs */}
      {feature.inputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Inputs ({feature.inputs.length})
          </h4>
          <div className="space-y-2">
            {feature.inputs.map((input) => (
              <div key={input.key} className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-2.5 border border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{input.label}</span>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1 rounded">{input.key}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{input.description}</p>
                {input.placeholder && (
                  <p className="text-[10px] text-gray-400 mt-0.5 italic">e.g. {input.placeholder}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {feature.outputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Outputs ({feature.outputs.length})
          </h4>
          <div className="space-y-2">
            {feature.outputs.map((output) => {
              const entry = registry[output.key];
              return (
                <div key={output.key} className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-2.5 border border-gray-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{entry?.label ?? output.key}</span>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1 rounded">{output.key}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{entry?.type ?? "count"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      {feature.charts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Charts ({feature.charts.length})
          </h4>
          <div className="space-y-1.5">
            {feature.charts.map((chart, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-white/[0.04] rounded-lg p-2.5 border border-gray-100 dark:border-white/[0.06]">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{chart.title}</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1 rounded">{chart.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entities */}
      {feature.entities.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Entities ({feature.entities.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {feature.entities.map((entity, i) => (
              <span key={i} className="text-xs bg-gray-50 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md border border-gray-100 dark:border-white/[0.06]">
                {entity.name}{entity.countKey ? ` → ${entity.countKey}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
