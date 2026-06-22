import { QueryProvider } from "@/lib/query-provider";
import { OnboardingCreditGate } from "@/components/onboarding/onboarding-credit-gate";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="flex min-h-dvh items-start justify-center bg-gray-50 px-3 py-4 sm:items-center sm:px-4 sm:py-6">
        <div className="w-full max-w-2xl min-w-0">
          <OnboardingCreditGate>{children}</OnboardingCreditGate>
        </div>
      </div>
    </QueryProvider>
  );
}
