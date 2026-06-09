import type { ValueRecap as ValueRecapData } from "@/data/benchmarks-content";

export function ValueRecap({ data, eyebrow }: { data: ValueRecapData; eyebrow?: string }) {
  return (
    <section className="v2-section-tight border-y border-[var(--v2-border)]">
      <div className="v2-shell max-w-3xl">
        {eyebrow && (
          <p className="v2-mono mb-2 text-xs uppercase tracking-wider text-[var(--v2-muted)]">
            {eyebrow}
          </p>
        )}
        <h3 className="v2-h2 mb-2 text-xl md:text-2xl">
          {data.headline}
        </h3>
        <p className="v2-body text-base">{data.body}</p>
      </div>
    </section>
  );
}
