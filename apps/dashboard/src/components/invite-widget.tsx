"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getInviteStatus } from "@/lib/api-invite";

interface InviteWidgetProps {
  orgId: string;
}

const LANDING_ORIGIN =
  process.env.NEXT_PUBLIC_LANDING_URL || "https://distribute.you";

export function InviteWidget({ orgId }: InviteWidgetProps) {
  const [copied, setCopied] = useState(false);

  const { data, isPending } = useAuthQuery(
    ["inviteStatus", orgId],
    () => getInviteStatus(orgId),
    { enabled: !!orgId },
  );

  if (isPending || !data) {
    return null;
  }

  if (data.expired || data.used >= data.total) {
    return null;
  }

  const inviteLink = `${LANDING_ORIGIN}/get-started?invite=${data.code}`;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[dashboard] copy invite link failed", err);
    }
  }

  return (
    <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/60">
      <div className="rounded-lg bg-white border border-gray-200 p-3">
        <p className="text-xs font-medium text-gray-700 mb-2">
          {data.used}/{data.total} invitations used
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="w-full text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 transition font-medium"
        >
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
