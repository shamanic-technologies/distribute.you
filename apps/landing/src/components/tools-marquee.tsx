import Image from "next/image";

interface Tool {
  domain: string;
  label: string;
}

const ROW_1: Tool[] = [
  { domain: "claude.ai", label: "Claude" },
  { domain: "cursor.com", label: "Cursor" },
  { domain: "openai.com", label: "OpenAI" },
  { domain: "anthropic.com", label: "Anthropic" },
  { domain: "lovable.dev", label: "Lovable" },
  { domain: "v0.dev", label: "v0" },
  { domain: "vercel.com", label: "Vercel" },
  { domain: "railway.com", label: "Railway" },
  { domain: "github.com", label: "GitHub" },
  { domain: "supabase.com", label: "Supabase" },
  { domain: "neon.tech", label: "Neon" },
  { domain: "fly.io", label: "Fly.io" },
];

const ROW_2: Tool[] = [
  { domain: "apollo.io", label: "Apollo" },
  { domain: "hunter.io", label: "Hunter" },
  { domain: "lemlist.com", label: "Lemlist" },
  { domain: "instantly.ai", label: "Instantly" },
  { domain: "smartlead.ai", label: "Smartlead" },
  { domain: "resend.com", label: "Resend" },
  { domain: "postmarkapp.com", label: "Postmark" },
  { domain: "mailgun.com", label: "Mailgun" },
  { domain: "sendgrid.com", label: "SendGrid" },
  { domain: "hubspot.com", label: "HubSpot" },
  { domain: "intercom.com", label: "Intercom" },
  { domain: "brevo.com", label: "Brevo" },
];

const ROW_3: Tool[] = [
  { domain: "stripe.com", label: "Stripe" },
  { domain: "lemonsqueezy.com", label: "Lemon Squeezy" },
  { domain: "posthog.com", label: "PostHog" },
  { domain: "mixpanel.com", label: "Mixpanel" },
  { domain: "plausible.io", label: "Plausible" },
  { domain: "clerk.com", label: "Clerk" },
  { domain: "auth0.com", label: "Auth0" },
  { domain: "workos.com", label: "WorkOS" },
  { domain: "linear.app", label: "Linear" },
  { domain: "notion.so", label: "Notion" },
  { domain: "slack.com", label: "Slack" },
  { domain: "x.com", label: "X" },
];

interface MarqueeRowProps {
  tools: Tool[];
  direction: "ltr" | "rtl";
  token?: string;
}

function MarqueeRow({ tools, direction, token }: MarqueeRowProps) {
  const animClass = direction === "ltr" ? "animate-marquee-ltr" : "animate-marquee-rtl";
  const doubled = [...tools, ...tools];
  return (
    <div className="overflow-hidden marquee-mask">
      <div className={`flex gap-10 w-max ${animClass}`}>
        {doubled.map((tool, idx) => (
          <div
            key={`${tool.domain}-${idx}`}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm flex-shrink-0"
          >
            {token ? (
              <Image
                src={`https://img.logo.dev/${tool.domain}?token=${token}&size=64`}
                alt={tool.label}
                width={28}
                height={28}
                className="rounded-md flex-shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-7 h-7 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-[10px] font-bold uppercase flex-shrink-0">
                {tool.label[0]}
              </div>
            )}
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {tool.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ToolsMarquee() {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  return (
    <div className="space-y-4">
      <MarqueeRow tools={ROW_1} direction="ltr" token={token} />
      <MarqueeRow tools={ROW_2} direction="rtl" token={token} />
      <MarqueeRow tools={ROW_3} direction="ltr" token={token} />
    </div>
  );
}
