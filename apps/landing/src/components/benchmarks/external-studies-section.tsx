import Image from "next/image";
import type { ExternalStudy } from "@/data/benchmarks-content";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

function ProviderAvatar({ provider, providerDomain }: { provider: string; providerDomain: string }) {
  if (providerDomain && LOGO_DEV_TOKEN) {
    return (
      <Image
        src={`https://img.logo.dev/${providerDomain}?token=${LOGO_DEV_TOKEN}&size=64`}
        alt={provider}
        width={32}
        height={32}
        className="rounded-md flex-shrink-0"
        unoptimized
      />
    );
  }
  return (
    <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center text-gray-500 text-sm font-bold flex-shrink-0">
      {provider[0]?.toUpperCase()}
    </div>
  );
}

function ExternalStudyCard({ study }: { study: ExternalStudy }) {
  return (
    <a
      href={study.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-md transition"
    >
      <div className="flex items-center gap-3 mb-4">
        <ProviderAvatar provider={study.provider} providerDomain={study.providerDomain} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{study.provider}</div>
          <div className="text-xs text-gray-400">{study.year}</div>
        </div>
      </div>
      <p className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-2 tabular-nums leading-tight">
        {study.headlineStat}
      </p>
      <p className="text-sm text-gray-600 leading-snug mb-3 flex-1">{study.title}</p>
      {study.quote && (
        <blockquote className="text-xs text-gray-500 italic leading-relaxed border-l-2 border-gray-200 pl-3 mb-4">
          &ldquo;{study.quote}&rdquo;
        </blockquote>
      )}
      <span className="text-xs text-gray-500 group-hover:text-gray-700 mt-auto pt-3 border-t border-gray-100 inline-flex items-center gap-1">
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
    <section className="py-12 md:py-16 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
            What the industry says
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            External benchmarks for {featureName}
          </h2>
          <p className="text-gray-500 text-base max-w-2xl">
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
