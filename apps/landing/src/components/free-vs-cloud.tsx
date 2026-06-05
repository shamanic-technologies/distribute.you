import { LinkButton } from "@/components/link-button";

interface CloudPlanCardProps {
  signUpUrl: string;
}

export function FreeVsCloud({ signUpUrl }: CloudPlanCardProps) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-gray-950 text-white rounded-2xl border-2 border-brand-500/40 p-6 md:p-8 shadow-2xl relative">
        <div className="absolute -top-3 left-6 px-3 py-1 bg-brand-500 text-white text-[10px] font-medium uppercase tracking-wider rounded-full">
          Pay as you go
        </div>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed mt-2">
          $25 welcome credits. No subscription.
        </p>
        <ul className="space-y-2.5 text-sm text-gray-300 mb-8">
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> We handle the sending infrastructure
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> Pre-warmed inboxes, agency-style sender
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> AI qualifies every reply, forwards positives to your Gmail
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> 9 channels live, more every month
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> Public unit prices, no hidden margin
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> Cost per reply tracked per product × per channel
          </li>
        </ul>
        <LinkButton
          href={signUpUrl}
          className="inline-block w-full text-center px-5 py-2.5 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-100 transition"
        >
          Start free — $25 credits
        </LinkButton>
        <p className="text-xs text-gray-500 mt-3 text-center">
          No credit card. Pay only what you use.
        </p>
      </div>
    </div>
  );
}
