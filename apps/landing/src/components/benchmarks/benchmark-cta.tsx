import { LinkButton } from "@/components/link-button";
import { resolveUrls } from "@/lib/env-urls";
import type { BenchmarkCTACopy } from "@/data/benchmarks-content";

interface BenchmarkCTAProps {
  copy: BenchmarkCTACopy;
  signUpUrl: string;
  variant?: "primary" | "closing";
}

export function BenchmarkCTA({ copy, signUpUrl, variant = "primary" }: BenchmarkCTAProps) {
  const dark = variant === "closing";
  return (
    <section
      className={`v2-section-tight border-y border-[var(--v2-border)] ${
        dark ? "bg-[oklch(6.5%_0.012_264)]" : "bg-[var(--v2-bg-alt)]"
      }`}
    >
      <div className="v2-shell max-w-3xl text-center">
        <h2 className="v2-h2 mb-3 text-2xl md:text-3xl">
          {copy.headline}
        </h2>
        <p className="v2-body mb-7 text-base md:text-lg">
          {copy.sub}
        </p>
        <LinkButton
          href={signUpUrl}
          className={dark ? "v2-button-ghost" : "v2-button-primary"}
        >
          {copy.cta}
        </LinkButton>
        <p className="v2-mono mt-4 text-xs text-[var(--v2-muted)]">
          50 free emails. No subscription. No credit card to try.
        </p>
      </div>
    </section>
  );
}

export function buildSignUpUrl(host: string): string {
  return resolveUrls(host).signUp;
}
