import type { ExternalStudy } from "@/data/benchmarks-content";
import { ProviderAvatar } from "@/components/provider-avatar";

function ExternalStudyCard({ study }: { study: ExternalStudy }) {
  return (
    <a
      href={study.url}
      target="_blank"
      rel="noopener noreferrer"
      className="v2-card group flex flex-col p-5 transition hover:border-[var(--v2-accent-brd)]"
    >
      <div className="flex items-center gap-3 mb-4">
        <ProviderAvatar provider={study.provider} providerDomain={study.providerDomain} size={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--v2-text)]">{study.provider}</div>
          <div className="v2-mono text-xs text-[var(--v2-muted)]">{study.year}</div>
        </div>
      </div>
      <p className="mb-2 text-2xl font-bold leading-tight text-[var(--v2-text)] tabular-nums md:text-3xl">
        {study.headlineStat}
      </p>
      <p className="v2-body mb-3 flex-1 text-sm leading-snug">{study.title}</p>
      {study.quote && (
        <blockquote className="mb-4 border-l-2 border-[var(--v2-border-hi)] pl-3 text-xs italic leading-relaxed text-[var(--v2-sub)]">
          &ldquo;{study.quote}&rdquo;
        </blockquote>
      )}
      <span className="v2-mono mt-auto inline-flex items-center gap-1 border-t border-[var(--v2-border)] pt-3 text-xs text-[var(--v2-muted)] group-hover:text-[var(--v2-text)]">
        Read source
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </span>
    </a>
  );
}

export function ExternalStudiesSection({ studies, featureName }: { studies: ExternalStudy[]; featureName: string }) {
  if (studies.length === 0) return null;
  return (
    <section className="v2-section-tight border-y border-[var(--v2-border)] bg-[var(--v2-bg-alt)]">
      <div className="v2-shell-wide">
        <div className="mb-8">
          <p className="v2-mono mb-2 text-xs uppercase tracking-wider text-[var(--v2-muted)]">
            What the industry says
          </p>
          <h2 className="v2-h2 mb-2 text-2xl md:text-3xl">
            External benchmarks for {featureName}
          </h2>
          <p className="v2-body max-w-2xl text-base">
            Independent studies from established providers. Every number linked to source — compare against the distribute leaderboard below.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {studies.map((s) => (
            <ExternalStudyCard key={s.url} study={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
