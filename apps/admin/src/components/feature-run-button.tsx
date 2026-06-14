"use client";

import { useState } from "react";
import { ApiError, triggerFeatureRun } from "@/lib/api";

interface FeatureRunButtonProps {
  featureSlug: string;
  brandId: string;
  campaignId: string;
}

export function FeatureRunButton({
  featureSlug,
  brandId,
  campaignId,
}: FeatureRunButtonProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await triggerFeatureRun(featureSlug, { brandId, campaignId });
      setSuccess(`Run started: ${result.workflowRunId}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message} (${err.status})`
          : err instanceof Error
            ? err.message
            : "Failed to trigger run";
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={running}
        className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        data-testid="trigger-run-button"
      >
        {running ? "Triggering..." : "Trigger run"}
      </button>
      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mt-2"
          data-testid="trigger-run-error"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mt-2"
          data-testid="trigger-run-success"
        >
          {success}
        </div>
      )}
    </div>
  );
}
