export function GmailInbox() {
  return (
    <div className="relative mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden text-left">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">
              Gmail replies
            </p>
            <p className="text-sm font-semibold text-gray-900">3 new today</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            buyer
          </span>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span className="text-gray-400">From</span>
            <span className="font-medium text-gray-900">
              Marcus Chen, Loopify.io{" "}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                buyer
              </span>
            </span>
            <span className="text-gray-400">Subj</span>
            <span className="font-medium text-gray-900">
              Re: interested in a demo this week
            </span>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
            Hi, See your message about cutting our onboarding time. We are 14 people
            and onboarding still takes 3 weeks. Where can I book 15 minutes this
            week? Marcus
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
          <span>47 sent today · 5 buyers</span>
          <span>Next up: replies</span>
        </div>
      </div>
    </div>
  );
}
