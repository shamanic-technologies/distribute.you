import { QueryProvider } from "@/lib/query-provider";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          {children}
        </div>
      </div>
    </QueryProvider>
  );
}
