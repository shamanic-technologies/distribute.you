"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignReplies, type Reply } from "@/lib/api";

const CLASSIFICATION_COLORS: Record<string, string> = {
  willing_to_meet: "bg-green-100 text-green-700 border-green-200",
  interested: "bg-blue-100 text-blue-700 border-blue-200",
  not_interested: "bg-gray-100 text-gray-500 border-gray-200",
  out_of_office: "bg-yellow-100 text-yellow-700 border-yellow-200",
  unsubscribe: "bg-red-100 text-red-600 border-red-200",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  willing_to_meet: "Willing to meet",
  interested: "Interested",
  not_interested: "Not interested",
  out_of_office: "Out of office",
  unsubscribe: "Unsubscribe",
};

export default function CampaignRepliesPage() {
  const params = useParams();
  const [filter, setFilter] = useState<string | null>(null);

  const { data, isLoading } = useAuthQuery(
    ["campaignReplies", params.id],
    (token) => listCampaignReplies(token, params.id as string),
    { refetchInterval: 5_000 },
  );
  const replies = data?.replies ?? [];

  const filteredReplies = filter 
    ? replies.filter(r => r.classification === filter) 
    : replies;

  const classificationCounts = replies.reduce((acc, r) => {
    const cls = r.classification || "unknown";
    acc[cls] = (acc[cls] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl font-bold text-gray-800">
          Replies
          <span className="ml-2 text-sm font-normal text-gray-500">({replies.length})</span>
        </h1>
      </div>

      {/* Filters */}
      {replies.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter(null)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              !filter ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            All ({replies.length})
          </button>
          {Object.entries(classificationCounts).map(([cls, count]) => (
            <button
              key={cls}
              onClick={() => setFilter(cls)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                filter === cls 
                  ? "bg-gray-800 text-white border-gray-800" 
                  : CLASSIFICATION_COLORS[cls] || "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {CLASSIFICATION_LABELS[cls] || cls} ({count})
            </button>
          ))}
        </div>
      )}

      {filteredReplies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">
            {filter ? "No replies with this classification" : "No replies yet"}
          </h3>
          <p className="text-gray-600 text-sm">
            {filter 
              ? "Try selecting a different filter." 
              : "Replies will appear here when leads respond."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReplies.map((reply) => (
            <div key={reply.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-800">
                    {reply.leadName || reply.leadEmail}
                  </p>
                  <p className="text-sm text-gray-500">{reply.leadEmail}</p>
                </div>
                {reply.classification && (
                  <span className={`text-xs px-2 py-1 rounded-full border ${CLASSIFICATION_COLORS[reply.classification] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {CLASSIFICATION_LABELS[reply.classification] || reply.classification}
                  </span>
                )}
              </div>
              {reply.snippet && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mt-2">
                  &quot;{reply.snippet}&quot;
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {new Date(reply.receivedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
