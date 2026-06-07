import { COLD_EMAIL_PAIN_STATS, type SourcedStat } from "@/data/sourced-stats";
import { ProviderAvatar } from "@/components/provider-avatar";

function StatCard({ stat }: { stat: SourcedStat }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <ProviderAvatar
          provider={stat.provider}
          providerDomain={stat.providerDomain}
          size={32}
        />
        <div className="text-sm font-semibold text-gray-900 truncate">
          {stat.provider}
        </div>
      </div>
      <p className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-2 tabular-nums">
        {stat.value}
      </p>
      <p className="text-sm text-gray-600 leading-relaxed flex-1">{stat.label}</p>
      <a
        href={stat.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 hover:text-gray-700 mt-4 pt-3 border-t border-gray-100 inline-flex items-center gap-1"
      >
        Source: <span className="underline underline-offset-2">{stat.sourceLabel}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}

export function ColdEmailPainStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLD_EMAIL_PAIN_STATS.map((s) => (
        <StatCard key={s.id} stat={s} />
      ))}
    </div>
  );
}
