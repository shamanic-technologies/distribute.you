import { LinkButton } from "@/components/link-button";

interface CloudPlanCardProps {
  signUpUrl: string;
}

const INCLUDED = [
  "Pre-warmed inboxes. Skip the 3-week setup.",
  "AI reads every reply. Only buyers reach your Gmail.",
  "$25 free credits. Enough to test the first 700 emails.",
  "Stop or pause anytime. Your money sits unused, not spent.",
];

export function FreeVsCloud({ signUpUrl }: CloudPlanCardProps) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-gray-950 text-white rounded-2xl border-2 border-brand-500/40 p-6 md:p-8 shadow-2xl relative">
        <div className="absolute -top-3 left-6 px-3 py-1 bg-brand-500 text-white text-[10px] font-medium uppercase tracking-wider rounded-full">
          Pay as you go
        </div>
        <ul className="mt-4 space-y-2.5 text-sm text-gray-300 mb-8">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-brand-400 mt-0.5">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <LinkButton
          href={signUpUrl}
          className="inline-block w-full text-center px-5 py-2.5 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-100 transition"
        >
          Start free, $25 credits
        </LinkButton>
      </div>
    </div>
  );
}
