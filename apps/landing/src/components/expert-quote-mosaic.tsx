import { EXPERT_QUOTES, type ExpertQuote } from "@/data/expert-quotes";

const ACCENT_CLASSES: Record<ExpertQuote["accent"], { bg: string; text: string; border: string }> = {
  amber: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  violet: { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  blue: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  pink: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  cyan: { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
  rose: { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function QuoteCard({ q }: { q: ExpertQuote }) {
  const a = ACCENT_CLASSES[q.accent];
  return (
    <figure
      className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 hover:border-gray-300 hover:shadow-sm transition flex flex-col"
      itemScope
      itemType="https://schema.org/Quotation"
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-11 h-11 rounded-full ${a.bg} ${a.text} ${a.border} border flex items-center justify-center font-display font-bold text-sm flex-shrink-0`}
          aria-hidden="true"
        >
          {initials(q.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className="font-semibold text-gray-900 text-sm truncate"
              itemProp="creator"
              itemScope
              itemType="https://schema.org/Person"
            >
              <span itemProp="name">{q.name}</span>
            </p>
            <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {q.handle} · {q.role}
          </p>
        </div>
      </div>
      <blockquote
        cite={q.sourceUrl}
        className="text-gray-800 text-[15px] leading-relaxed flex-1"
        itemProp="text"
      >
        &ldquo;{q.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-4 pt-3 border-t border-gray-100">
        <a
          href={q.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          itemProp="citation"
        >
          Source: <span className="underline underline-offset-2">{q.sourceLabel}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </figcaption>
    </figure>
  );
}

export function ExpertQuoteMosaic() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {EXPERT_QUOTES.map((q) => (
        <QuoteCard key={q.id} q={q} />
      ))}
    </div>
  );
}

export function expertQuoteJsonLd() {
  return EXPERT_QUOTES.map((q) => ({
    "@context": "https://schema.org",
    "@type": "Quotation",
    text: q.quote,
    creator: {
      "@type": "Person",
      name: q.name,
    },
    citation: q.sourceUrl,
  }));
}
