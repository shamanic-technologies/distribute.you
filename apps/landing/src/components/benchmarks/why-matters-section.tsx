import type { WhyMattersSection as WhyMattersData } from "@/data/benchmarks-content";

export function WhyMattersSection({ data }: { data: WhyMattersData }) {
  return (
    <section className="dy-section-tight">
      <div className="dy-shell max-w-3xl">
        <p className="dy-mono mb-3 text-xs uppercase tracking-wider text-[var(--dy-muted)]">
          {data.eyebrow}
        </p>
        <h2 className="dy-h2 mb-5 text-2xl md:text-4xl">
          {data.title}
        </h2>
        <p className="dy-body text-base md:text-lg">
          {data.body}
        </p>
      </div>
    </section>
  );
}
