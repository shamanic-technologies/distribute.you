import { useFeatures } from "@/lib/features-context";
import { GA_BRAND_FEATURES } from "@/lib/feature-gates";

/**
 * Canonical sole-feature slug. The product ships exactly ONE GA feature, so the
 * feature level was flattened into the brand — there is no longer a
 * `/features/[featureSlug]` route segment. Pages that still need a slug for
 * backend calls (`/features/:slug/...` API routes, query keys) resolve it here
 * instead of reading a route param.
 */
export const SOLE_FEATURE_SLUG = "sales-cold-email-outreach";

/**
 * Resolve the single GA + implemented feature slug from features-context. Falls
 * back to {@link SOLE_FEATURE_SLUG} while features-context is still loading (the
 * GA set has one member today, so the fallback equals the resolved value). When
 * a second feature ships GA this needs revisiting — the flatten assumes one.
 */
export function useSoleFeatureSlug(): string {
  const { features } = useFeatures();
  const ga = features.find((f) => f.implemented && GA_BRAND_FEATURES.has(f.slug));
  return ga?.slug ?? SOLE_FEATURE_SLUG;
}
