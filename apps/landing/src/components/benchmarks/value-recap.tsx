import type { ValueRecap as ValueRecapData } from "@/data/benchmarks-content";

export function ValueRecap({ data, eyebrow }: { data: ValueRecapData; eyebrow?: string }) {
  return (
    <section className="dy-section-tight border-y border-[var(--dy-border)]">
      <div className="dy-shell max-w-3xl">
        {eyebrow && (
          <p className="dy-mono mb-2 text-xs uppercase tracking-wider text-[var(--dy-muted)]">
            {eyebrow}
          </p>
        )}
        <h3 className="dy-h2 mb-2 text-xl md:text-2xl">
          {data.headline}
        </h3>
        <p className="dy-body text-base">{data.body}</p>
      </div>
    </section>
  );
}
