"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { generateWorkflow } from "@/lib/api";
import { useFeatures } from "@/lib/features-context";

/**
 * Intermediate page that shows the workflow-detail skeleton
 * while generateWorkflow runs in the background.
 * Navigates to the real workflow page as soon as it's ready.
 */
export default function NewWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  const { getFeature } = useFeatures();
  const wfDef = getFeature(featureSlug);

  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      generateWorkflow({
        description: `Create a ${wfDef?.name ?? featureSlug} workflow: ${wfDef?.description ?? "automated workflow for this feature"}.`,
        featureSlug: featureSlug,
        hints: {},
      }),
    onSuccess: (result) => {
      router.replace(
        `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows/${result.workflow.id}`,
      );
    },
    onError: () => {
      setError("Failed to create workflow.");
    },
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">
            {error}
          </h3>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  /* ── Skeleton matching the workflow detail page layout ── */
  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Desktop sidebar skeleton */}
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded-md w-3/4 animate-pulse" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
                <div className="h-5 w-12 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-5 space-y-3">
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-full animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-5/6 animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-2/3 animate-pulse" />
        </div>
      </aside>

      {/* Main area skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header skeleton */}
        <div className="lg:hidden border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded w-40 animate-pulse" />
          </div>
        </div>

        {/* Chat area skeleton */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
          <div className="w-10 h-10 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generating workflow&hellip;
          </p>
        </div>
      </div>
    </div>
  );
}
