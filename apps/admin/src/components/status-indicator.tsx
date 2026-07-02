"use client";

import { useEffect, useState } from "react";

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
    <span className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
      <span className={`w-2 h-2 ${config.color} rounded-full`} />
      {config.text}
    </span>
  );
}
