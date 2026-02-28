"use client";

import { useEffect, useState } from "react";

const STATUS_PAGE_URL = "https://status.distribute.you";

export function StatusIndicator() {
  const [status, setStatus] = useState<"operational" | "degraded" | "down" | "loading">("loading");

  useEffect(() => {
    // For now, just show operational (Better Stack will provide real status later)
    setStatus("operational");
  }, []);

  const statusConfig = {
    loading: {
      color: "bg-gray-400",
      text: "Checking...",
    },
    operational: {
      color: "bg-green-500",
      text: "All systems operational",
    },
    degraded: {
      color: "bg-yellow-500",
      text: "Partial outage",
    },
    down: {
      color: "bg-red-500",
      text: "Major outage",
    },
  };

  const config = statusConfig[status];

  return (
    <a
      href={STATUS_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-primary-600 transition"
    >
      <span className={`w-2 h-2 ${config.color} rounded-full`} />
      {config.text}
    </a>
  );
}
