import Image from "next/image";
import {
  EXPERT_QUOTES,
  QUOTE_ROW_1,
  QUOTE_ROW_2,
  QUOTE_ROW_3,
  type ExpertQuote,
} from "@/data/expert-quotes";

function QuoteCard({ q }: { q: ExpertQuote }) {
  return (
    <figure
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 w-[360px] flex-shrink-0 flex flex-col"
      itemScope
      itemType="https://schema.org/Quotation"
    >
      <div className="flex items-center gap-3 mb-3">
        <Image
          src={q.avatarUrl}
          alt={q.name}
          width={44}
          height={44}
          className="rounded-full flex-shrink-0 bg-gray-100"
          unoptimized
        />
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
        className="text-gray-800 text-[14px] leading-relaxed flex-1 line-clamp-4"
        itemProp="text"
      >
        &ldquo;{q.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-3 pt-2.5 border-t border-gray-100">
        <a
          href={q.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-gray-400 hover:text-gray-600 inline-flex items-center gap-1"
          itemProp="citation"
        >
          <span className="underline underline-offset-2">{q.sourceLabel}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </figcaption>
    </figure>
  );
}

interface MarqueeRowProps {
  quotes: ExpertQuote[];
  direction: "ltr" | "rtl";
}

function MarqueeRow({ quotes, direction }: MarqueeRowProps) {
  const animClass = direction === "ltr" ? "animate-marquee-ltr" : "animate-marquee-rtl";
  const doubled = [...quotes, ...quotes];
  return (
    <div className="overflow-hidden marquee-mask">
      <div className={`flex gap-4 w-max ${animClass}`}>
        {doubled.map((q, idx) => (
          <QuoteCard key={`${q.id}-${idx}`} q={q} />
        ))}
      </div>
    </div>
  );
}

export function ExpertQuoteMosaic() {
  return (
    <div className="space-y-4">
      <MarqueeRow quotes={QUOTE_ROW_1} direction="ltr" />
      <MarqueeRow quotes={QUOTE_ROW_2} direction="rtl" />
      <MarqueeRow quotes={QUOTE_ROW_3} direction="ltr" />
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
