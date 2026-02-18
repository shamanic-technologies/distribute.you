"use client";

import { LinkButton } from "@/components/link-button";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listByokKeys } from "@/lib/api";

const REQUIRED_PROVIDERS = ["anthropic", "apollo", "instantly", "firecrawl"];

export function SalesColdEmailsCard() {
  const { data, isLoading } = useAuthQuery(["byok-keys"], (token) =>
    listByokKeys(token)
  );
  const keys = data?.keys ?? [];
  const configuredCount = REQUIRED_PROVIDERS.filter((p) =>
    keys.some((k) => k.provider === p)
  ).length;
  const isComplete = configuredCount === REQUIRED_PROVIDERS.length;
  const hasAny = configuredCount > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="text-3xl mb-3">📧</div>
      <h3 className="font-display font-bold text-lg text-gray-800 mb-2">
        Sales Cold Emails
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Generate and send personalized cold emails from any URL.
      </p>
      {isLoading ? (
        <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
      ) : isComplete ? (
        <LinkButton
          href="/setup"
          className="text-gray-400 hover:text-gray-500 font-medium text-sm"
        >
          View setup
        </LinkButton>
      ) : (
        <LinkButton
          href="/setup"
          className="text-primary-500 hover:text-primary-600 font-medium text-sm"
        >
          {hasAny ? "Complete setup →" : "Get Started →"}
        </LinkButton>
      )}
    </div>
  );
}
