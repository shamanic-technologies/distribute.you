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
      className={`dy-section-tight border-y border-[var(--dy-border)] ${
        dark ? "bg-[oklch(6.5%_0.012_264)]" : "bg-[var(--dy-bg-alt)]"
      }`}
    >
      <div className="dy-shell max-w-3xl text-center">
        <h2 className="dy-h2 mb-3 text-2xl md:text-3xl">
          {copy.headline}
        </h2>
        <p className="dy-body mb-7 text-base md:text-lg">
          {copy.sub}
        </p>
        <LinkButton
          href={signUpUrl}
          className={dark ? "dy-button-ghost" : "dy-button-primary"}
        >
          {copy.cta}
        </LinkButton>
        <p className="dy-mono mt-4 text-xs text-[var(--dy-muted)]">
          $25 free credits. No subscription.
        </p>
      </div>
    </section>
  );
}

export function buildSignUpUrl(host: string): string {
  return resolveUrls(host).signUp;
}
