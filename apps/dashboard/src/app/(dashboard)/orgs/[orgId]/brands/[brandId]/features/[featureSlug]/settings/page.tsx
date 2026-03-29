"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getFeature, getBrand } from "@/lib/api";
import { useFeatures } from "@/lib/features-context";
import { FeatureCreatorChat } from "@/components/features/feature-creator-chat";

/* ─── Sidebar skeleton ───────────────────────────────────────────── */

function SidebarSkeleton() {
  return (
    <>
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
    </>
  );
}

/* ─── Feature overview panel ─────────────────────────────────────── */

function FeatureOverview({ feature, registry }: {
  feature: {
    slug: string;
    name: string;
    description: string;
    icon?: string;
    category: string;
    channel: string;
    audienceType: string;
    inputs: Array<{ key: string; label: string; description: string; placeholder?: string; type?: string; extractKey?: string }>;
    outputs: Array<{ key: string; displayOrder?: number }>;
    charts: Array<{ type: string; title: string }>;
    entities: Array<{ name: string; countKey?: string }>;
  };
  registry: Record<string, { label?: string; type?: string }>;
}) {
  return (
    <div className="space-y-5">
      {/* Description */}
      {feature.description && (
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {feature.description}
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-1.5">
        {feature.category && (
          <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
            {feature.category}
          </span>
        )}
        {feature.channel && (
          <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
            {feature.channel}
          </span>
        )}
        {feature.audienceType && (
          <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
            {feature.audienceType}
          </span>
        )}
      </div>

      {/* Inputs */}
      {feature.inputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Inputs ({feature.inputs.length})
          </h4>
          <div className="space-y-2">
            {feature.inputs.map((input) => (
              <div key={input.key} className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-2.5 border border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{input.label}</span>
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1 rounded">{input.key}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{input.description}</p>
                {input.placeholder && (
                  <p className="text-[10px] text-gray-400 mt-0.5 italic">e.g. {input.placeholder}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {feature.outputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Outputs ({feature.outputs.length})
          </h4>
          <div className="space-y-2">
            {feature.outputs.map((output) => {
              const entry = registry[output.key];
              return (
                <div key={output.key} className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-2.5 border border-gray-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{entry?.label ?? output.key}</span>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1 rounded">{output.key}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{entry?.type ?? "count"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      {feature.charts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Charts ({feature.charts.length})
          </h4>
          <div className="space-y-1.5">
            {feature.charts.map((chart, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-white/[0.04] rounded-lg p-2.5 border border-gray-100 dark:border-white/[0.06]">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{chart.title}</span>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1 rounded">{chart.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entities */}
      {feature.entities.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Entities ({feature.entities.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {feature.entities.map((entity, i) => (
              <span key={i} className="text-xs bg-gray-50 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md border border-gray-100 dark:border-white/[0.06]">
                {entity.name}{entity.countKey ? ` → ${entity.countKey}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function FeatureSettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  const { registry, features: existingFeatures } = useFeatures();

  const { data: featureData, isLoading } = useAuthQuery(
    ["feature", featureSlug],
    () => getFeature(featureSlug),
  );
  const feature = featureData?.feature ?? null;

  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
  );
  const brand = brandData?.brand ?? null;

  const chatId = `feature-settings-${featureSlug}-${brandId}`;

  // Build stats registry reference
  const statsRegistryRef = useMemo(() => registry, [registry]);

  // Build existing features reference for context
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

  const featureContext = useMemo(() => {
    if (!feature) return {};
    return {
      type: "feature-settings",
      featureSlug: feature.slug,
      brandId,
      brand: brand ? {
        name: brand.name,
        domain: brand.domain,
        brandUrl: brand.brandUrl,
      } : null,
      feature: {
        slug: feature.slug,
        name: feature.name,
        description: feature.description,
        icon: feature.icon,
        category: feature.category,
        channel: feature.channel,
        audienceType: feature.audienceType,
        inputs: feature.inputs.map((inp) => ({
          key: inp.key,
          label: inp.label,
          type: inp.type,
          description: inp.description,
          extractKey: inp.extractKey,
        })),
        outputs: feature.outputs.map((out) => ({
          key: out.key,
          displayOrder: out.displayOrder,
        })),
        charts: feature.charts,
        entities: feature.entities,
      },
      existingFeatures: existingFeaturesRef,
      statsRegistry: statsRegistryRef,
      instructions: [
        "You are a feature assistant for the distribute.you platform.",
        "",
        "== CURRENT FEATURE ==",
        `Name: ${feature.name}`,
        `Slug: ${feature.slug}`,
        `Description: ${feature.description}`,
        "",
        "You have access to the COMPLETE feature definition including inputs, outputs, charts, and entities.",
        "The user can ask questions about this feature or request changes to its configuration.",
        "",
        "A feature has: name, description, icon, category, channel, audienceType, inputs[], outputs[], charts[], and entities[].",
        "",
        "INPUTS: Each input has: key, label, type (text|textarea|number|select), placeholder, description, extractKey.",
        "",
        "OUTPUTS: Each output has: key and displayOrder. Keys must come from the statsRegistry.",
        "",
        "CHARTS: Two types: funnel-bar and breakdown-bar. Keys reference statsRegistry entries.",
        "",
        "ENTITIES: Array of entity objects with name and optional countKey (from statsRegistry).",
        "",
        "== EXISTING FEATURES ==",
        "You have the full catalog in 'existingFeatures' in the context for reference.",
        "",
        "== SCOPE ==",
        "Your scope is this feature. Help the user understand its configuration,",
        "answer questions about inputs/outputs/charts, and propose modifications.",
        "Be concise and practical.",
      ].join("\n"),
    };
  }, [feature, brand, brandId, existingFeaturesRef, statsRegistryRef]);

  if (!isLoading && !feature) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Feature not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Desktop: side panel with feature details */}
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        {feature ? (
          <>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-[15px] font-bold text-gray-900 dark:text-gray-100 truncate">
                    {feature.name}
                  </h1>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate mt-0.5">{feature.slug}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <FeatureOverview feature={feature} registry={registry} />
            </div>
          </>
        ) : (
          <SidebarSkeleton />
        )}
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: collapsible feature details header */}
        <MobileFeatureHeader feature={feature} />

        {/* Chat */}
        <FeatureCreatorChat
          chatId={chatId}
          featureContext={featureContext}
        />
      </div>
    </div>
  );
}

/* ─── Mobile header ──────────────────────────────────────────────── */

function MobileFeatureHeader({ feature }: { feature: { name: string; slug: string } | null }) {
  if (!feature) {
    return (
      <div className="lg:hidden border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
          <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded w-40 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="lg:hidden border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
          {feature.name} — Settings
        </h1>
      </div>
    </div>
  );
}
