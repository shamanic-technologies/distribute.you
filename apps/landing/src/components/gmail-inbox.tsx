import Image from "next/image";

interface InboxEntry {
  senderDomain: string;
  senderLabel: string;
  fallbackLetter: string;
  fallbackColor: string;
  subject: string;
  preview: string;
  time: string;
  starred?: boolean;
}

export function GmailInbox() {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

  const entries: InboxEntry[] = [
    {
      senderDomain: "techcrunch.com",
      senderLabel: "Sarah · TechCrunch (via distribute)",
      fallbackLetter: "T",
      fallbackColor: "bg-emerald-500",
      subject: "🎯 Qualified lead: Sarah from TechCrunch replied",
      preview: "Sarah Lee (TechCrunch) wants to cover your launch — full thread inside, ready to reply.",
      time: "9:41 AM",
      starred: true,
    },
    {
      senderDomain: "shopify.com",
      senderLabel: "Mike · Shopify (via distribute)",
      fallbackLetter: "S",
      fallbackColor: "bg-emerald-500",
      subject: "🎯 Qualified lead: Mike (Shopify) wants a 30-min demo",
      preview: "Booked tentatively for Thursday — confirm or reschedule from the thread.",
      time: "8:12 AM",
      starred: true,
    },
    {
      senderDomain: "linear.app",
      senderLabel: "Lisa · Linear (via distribute)",
      fallbackLetter: "L",
      fallbackColor: "bg-emerald-500",
      subject: "🎯 Qualified candidate: Lisa, Senior Frontend Engineer",
      preview: "8 yrs React + Next.js, currently @ Linear, open to chat about the role.",
      time: "Yesterday",
    },
    {
      senderDomain: "distribute.you",
      senderLabel: "distribute.you · Daily digest",
      fallbackLetter: "D",
      fallbackColor: "bg-pink-500",
      subject: "📊 Daily digest — 47 sent · 3 qualified replies · $1.26",
      preview: "mailmesh.com: 2 leads · prompthub.ai: 1 lead · voiceform.io: 0 (no qualified reply).",
      time: "Yesterday",
    },
  ];

  return (
    <div className="relative mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        {/* Gmail-style header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            {token ? (
              <Image
                src={`https://img.logo.dev/gmail.com?token=${token}&size=64`}
                alt="Gmail"
                width={22}
                height={22}
                className="flex-shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-[22px] h-[22px] bg-red-500 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                M
              </div>
            )}
            <span className="font-medium text-gray-800 text-sm">Inbox</span>
          </div>
          <span className="text-xs text-gray-500">4 messages from distribute.you</span>
        </div>

        {/* Inbox list */}
        <div className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <div
              key={entry.subject}
              className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
            >
              {token ? (
                <Image
                  src={`https://img.logo.dev/${entry.senderDomain}?token=${token}&size=64`}
                  alt={entry.senderLabel}
                  width={32}
                  height={32}
                  className="rounded-full flex-shrink-0 border border-gray-100"
                  unoptimized
                />
              ) : (
                <div
                  className={`w-8 h-8 rounded-full ${entry.fallbackColor} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
                >
                  {entry.fallbackLetter}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {entry.senderLabel}
                  </span>
                  {entry.starred && (
                    <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.363-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{entry.time}</span>
                </div>
                <p className="text-sm text-gray-800 truncate">{entry.subject}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{entry.preview}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 text-center">
          Replies are AI-qualified and forwarded only when they&apos;re worth your time.
        </div>
      </div>

      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400/10 via-cyan-500/10 to-violet-500/10 rounded-3xl blur-3xl -z-10" />
    </div>
  );
}
