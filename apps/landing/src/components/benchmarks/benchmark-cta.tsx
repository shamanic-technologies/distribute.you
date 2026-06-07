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
      className={`py-14 md:py-16 px-4 ${dark ? "bg-gray-900" : "bg-gray-50 border-y border-gray-100"}`}
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className={`font-display text-2xl md:text-3xl font-bold mb-3 ${
            dark ? "text-white" : "text-gray-900"
          }`}
        >
          {copy.headline}
        </h2>
        <p className={`mb-7 text-base md:text-lg ${dark ? "text-gray-400" : "text-gray-600"}`}>
          {copy.sub}
        </p>
        <LinkButton
          href={signUpUrl}
          className={
            dark
              ? "inline-block bg-white text-gray-900 px-7 py-3 rounded-lg font-medium hover:bg-gray-100 transition text-sm"
              : "inline-block bg-brand-500 text-white px-7 py-3 rounded-lg font-medium hover:bg-brand-600 transition text-sm"
          }
        >
          {copy.cta}
        </LinkButton>
        <p className={`text-xs mt-4 ${dark ? "text-gray-500" : "text-gray-400"}`}>
          $25 welcome credits. No subscription. No credit card to try.
        </p>
      </div>
    </section>
  );
}

export function buildSignUpUrl(host: string): string {
  return resolveUrls(host).signUp;
}
