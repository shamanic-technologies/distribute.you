import type { ExternalStudy } from "@/data/benchmarks-content";
import { ProviderAvatar } from "@/components/provider-avatar";

function ExternalStudyCard({ study }: { study: ExternalStudy }) {
  return (
    <a
      href={study.url}
      target="_blank"
      rel="noopener noreferrer"
      className="dy-card group flex flex-col p-5 transition hover:border-[var(--dy-accent-brd)]"
    >
      <div className="flex items-center gap-3 mb-4">
        <ProviderAvatar provider={study.provider} providerDomain={study.providerDomain} size={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--dy-text)]">{study.provider}</div>
          <div className="dy-mono text-xs text-[var(--dy-muted)]">{study.year}</div>
        </div>
      </div>
      <p className="mb-2 text-2xl font-bold leading-tight text-[var(--dy-text)] tabular-nums md:text-3xl">
        {study.headlineStat}
      </p>
      <p className="dy-body mb-3 flex-1 text-sm leading-snug">{study.title}</p>
      {study.quote && (
        <blockquote className="mb-4 border-l-2 border-[var(--dy-border-hi)] pl-3 text-xs italic leading-relaxed text-[var(--dy-sub)]">
          &ldquo;{study.quote}&rdquo;
        </blockquote>
      )}
      <span className="dy-mono mt-auto inline-flex items-center gap-1 border-t border-[var(--dy-border)] pt-3 text-xs text-[var(--dy-muted)] group-hover:text-[var(--dy-text)]">
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
    <section className="dy-section-tight border-y border-[var(--dy-border)] bg-[var(--dy-bg-alt)]">
      <div className="dy-shell-wide">
        <div className="mb-8">
          <p className="dy-mono mb-2 text-xs uppercase tracking-wider text-[var(--dy-muted)]">
            What the industry says
          </p>
          <h2 className="dy-h2 mb-2 text-2xl md:text-3xl">
            External benchmarks for {featureName}
          </h2>
          <p className="dy-body max-w-2xl text-base">
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
