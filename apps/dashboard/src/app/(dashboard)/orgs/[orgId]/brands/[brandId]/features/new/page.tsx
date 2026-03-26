"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getBrand, createFeature, ApiError, type FeatureInput, type FeatureOutput } from "@/lib/api";
import { useFeatures } from "@/lib/features-context";
import { FeatureBuilderPanel, EMPTY_DRAFT, type FeatureDraft } from "@/components/features/feature-builder-panel";
import { FeatureCreatorChat } from "@/components/features/feature-creator-chat";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

function PageSkeleton() {
  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded-md w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded-md w-1/2 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-5 space-y-3">
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-full animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-5/6 animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-2/3 animate-pulse" />
        </div>
      </aside>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] animate-pulse mb-4" />
        <div className="h-4 w-48 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse mb-2" />
        <div className="h-3 w-64 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function CreateFeaturePage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<FeatureDraft>({ ...EMPTY_DRAFT });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: brandData, isLoading } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
  );
  const brand = brandData?.brand ?? null;
  const { features: existingFeatures, registry } = useFeatures();

  const chatId = `feature-new-${brandId}`;

  // Build a compact reference of existing features for the LLM context
  const existingFeaturesRef = useMemo(() =>
    existingFeatures.map((f) => ({
      slug: f.slug,
      name: f.name,
      description: f.description,
      inputs: f.inputs.map((inp) => ({ key: inp.key, label: inp.label, description: inp.description })),
      outputs: f.outputs.map((out) => ({ key: out.key, displayOrder: out.displayOrder })),
      charts: f.charts,
      entities: f.entities,
    })),
    [existingFeatures],
  );

  // Build stats registry reference: { key: { type, label } }
  const statsRegistryRef = useMemo(() => registry, [registry]);

  const featureContext = useMemo(() => ({
    type: "feature-creator",
    brandId,
    brand: brand ? {
      name: brand.name,
      domain: brand.domain,
      brandUrl: brand.brandUrl,
    } : null,
    currentDraft: draft,
    existingFeatures: existingFeaturesRef,
    statsRegistry: statsRegistryRef,
    instructions: [
      "You are a feature designer for the distribute.you platform.",
      "Your ONLY job is to help define a feature's INPUTS and OUTPUTS. Nothing else.",
      "",
      "STRICT SCOPE — DO NOT:",
      "- Create, modify, or discuss workflows or DAGs",
      "- Call list_workflows, update_workflow, or any workflow-related tools",
      "- Create prompt templates or discuss implementation details",
      "- Suggest building anything beyond the feature definition itself",
      "",
      "A feature has: name, description, icon, category, channel, audienceType, inputs[], outputs[], charts[], and entities[].",
      "",
      "INPUTS: Each input has: key, label, type (text|textarea|number|select), placeholder, description, extractKey (snake_case version of key). If type is 'select', include options[].",
      "",
      "OUTPUTS: Each output has: key and displayOrder (integer). The key MUST be one of the allowed stats keys from the 'statsRegistry' in the context. Do NOT invent new keys — only use keys that exist in the registry. Present the available keys to the user when discussing outputs.",
      "",
      "CHARTS: Required. Array of chart definitions. Two types:",
      "  - funnel-bar: { key, type: 'funnel-bar', title, displayOrder, steps: [{ key }] } (min 2 steps, keys must be from statsRegistry)",
      "  - breakdown-bar: { key, type: 'breakdown-bar', title, displayOrder, segments: [{ key, color: green|blue|red|gray|orange, sentiment: positive|neutral|negative }] } (min 2 segments, keys must be from statsRegistry)",
      "",
      "ENTITIES: Required. Array of entity objects shown in campaign detail sidebar. Each entity has: name (string) and optional countKey (string, must be a key from statsRegistry). Example: [{name: 'leads', countKey: 'leadsServed'}, {name: 'companies'}, {name: 'emails', countKey: 'emailsGenerated'}]. The countKey determines which stat counter to show as a badge next to the entity in the sidebar.",
      "",
      "ICON: A Lucide icon name (e.g. 'envelope', 'globe', 'megaphone', 'newspaper', 'link'). See lucide.dev/icons.",
      "",
      "EXISTING FEATURES: You have the full catalog in 'existingFeatures' in the context, including their charts and entities. Use them as reference patterns when designing new features.",
      "When the user describes a new feature, FIRST check if a similar one already exists.",
      "If one does, present its inputs/outputs and suggest adapting from it.",
      "If the user asks to look at an existing feature, read its details from the context.",
      "",
      "When the user says 'go ahead' or validates the design, summarize the final feature definition (name, description, inputs, outputs, charts, entities) clearly.",
      "Format inputs and outputs as tables with key, label, and description columns.",
      "Be concise and practical. Ask clarifying questions when needed.",
    ].join("\n"),
  }), [brandId, brand, draft, existingFeaturesRef, statsRegistryRef]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await createFeature({
        name: draft.name,
        description: draft.description,
        icon: draft.icon || "sparkles",
        category: draft.category,
        channel: draft.channel,
        audienceType: draft.audienceType,
        inputs: draft.inputs.map((inp): FeatureInput => ({
          key: inp.key,
          label: inp.label,
          description: inp.description,
          placeholder: inp.placeholder ?? inp.label,
          type: inp.type ?? "text",
          extractKey: inp.extractKey ?? inp.key,
          ...(inp.options ? { options: inp.options } : {}),
        })),
        outputs: draft.outputs.map((out, i): FeatureOutput => ({
          key: out.key,
          displayOrder: out.displayOrder ?? i,
        })),
        charts: draft.charts,
        entities: draft.entities,
      });
      await queryClient.invalidateQueries({ queryKey: ["features"] });
      router.push(`/orgs/${orgId}/brands/${brandId}/features/${result.feature.slug}`);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save feature");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, draft, queryClient, router, orgId, brandId]);

  const handleFeatureUpdate = (partial: Partial<FeatureDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Desktop: side panel with feature builder */}
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        <FeatureBuilderPanel draft={draft} onDraftChange={setDraft} onSave={handleSave} isSaving={isSaving} saveError={saveError} />
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: collapsible feature builder header */}
        <div className="lg:hidden border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h1 className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {draft.name || "New Feature"}
              </h1>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 flex-shrink-0">
                {draft.inputs.length} inputs / {draft.outputs.length} outputs
              </span>
            </div>
            <ChevronDownIcon
              className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {detailsOpen && (
            <div className="border-t border-gray-100 dark:border-white/[0.04] bg-gray-50/30 dark:bg-white/[0.02] max-h-[50vh] overflow-y-auto">
              <FeatureBuilderPanel draft={draft} onDraftChange={setDraft} onSave={handleSave} isSaving={isSaving} saveError={saveError} />
            </div>
          )}
        </div>

        {/* Chat */}
        <FeatureCreatorChat
          chatId={chatId}
          featureContext={featureContext}
          onFeatureUpdate={handleFeatureUpdate}
        />
      </div>
    </div>
  );
}
