import { QueryProvider } from "@/lib/query-provider";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="flex min-h-dvh items-start justify-center bg-gray-50 px-3 py-4 sm:items-center sm:px-4 sm:py-6">
        <div className="w-full max-w-xl min-w-0">
          {children}
        </div>
      </div>
    </QueryProvider>
  );
}
