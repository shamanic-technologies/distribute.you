import { URLS } from "@distribute/content";
import { LinkButton } from "@/components/link-button";

interface TierProps {
  signUpUrl: string;
}

export function FreeVsCloud({ signUpUrl }: TierProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {/* Free / self-host */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Free · self-host
          </span>
        </div>
        <h3 className="font-display text-2xl font-bold text-gray-900 mb-2">
          Run it yourself.
        </h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          20+ open-source repos under MIT. Bring your own API keys, your own deliverability,
          your own infrastructure. Pay only the raw API providers.
        </p>
        <ul className="space-y-2.5 text-sm text-gray-700 mb-8">
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">✓</span> All workflows, fully open source
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">✓</span> Run anywhere — your laptop, your VPS
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">✓</span> Modify prompts, models, sequences
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">✓</span> Contribute back via PR
          </li>
        </ul>
        <LinkButton
          href={URLS.github}
          external
          className="inline-block w-full text-center px-5 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm font-medium hover:bg-gray-50 transition"
        >
          View on GitHub →
        </LinkButton>
        <p className="text-xs text-gray-400 mt-3 text-center">
          $0 / month. 20+ repos.
        </p>
      </div>

      {/* Pay-as-you-go */}
      <div className="bg-gray-950 text-white rounded-2xl border-2 border-brand-500/40 p-6 md:p-8 shadow-2xl relative">
        <div className="absolute -top-3 left-6 px-3 py-1 bg-brand-500 text-white text-[10px] font-medium uppercase tracking-wider rounded-full">
          Recommended
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-brand-400 uppercase tracking-wider">
            Pay-as-you-go · cloud
          </span>
        </div>
        <h3 className="font-display text-2xl font-bold mb-2">
          We run it for you.
        </h3>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          $2 welcome credits. No subscription. We handle the sending infrastructure,
          warmed inboxes, reply qualification, and Gmail forwarding.
        </p>
        <ul className="space-y-2.5 text-sm text-gray-300 mb-8">
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> 9 channels live, more every month
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> Agency-style sender, fully managed
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> AI qualifies replies, forwards to your Gmail
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> Public unit prices, no hidden margin
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-400 mt-0.5">✓</span> CAC tracked per product × per channel
          </li>
        </ul>
        <LinkButton
          href={signUpUrl}
          className="inline-block w-full text-center px-5 py-2.5 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-100 transition"
        >
          Start free — $2 credits
        </LinkButton>
        <p className="text-xs text-gray-500 mt-3 text-center">
          No credit card. Pay only what you use.
        </p>
      </div>
    </div>
  );
}
