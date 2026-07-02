"use client";

import { useEffect, useState } from "react";

export function StatusIndicator() {
  const [status, setStatus] = useState<"operational" | "degraded" | "down" | "loading">("loading");

  useEffect(() => {
    // For now, just show operational (Better Stack will provide real status later)
    // You can replace this with an actual API call to your status page
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
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 ${config.color} rounded-full animate-pulse`} />
      {config.text}
    </span>
  );
}
