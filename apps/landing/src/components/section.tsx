import type { ReactNode, ElementType } from "react";

/**
 * Section — shared horizontal-spacing wrapper for every public landing page.
 *
 * Enforces a 3-tier width hierarchy so the eye never sees abrupt jumps between
 * narrow text and wide visuals on the same page. Pick the variant by content
 * type; never inline `max-w-*` on a section's outer container.
 *
 * Width tiers (Tailwind):
 *   prose   → max-w-3xl  ( 768px) — long-form reading, 45-75 char/line
 *   content → max-w-5xl  (1024px) — default marketing sections
 *   wide    → max-w-7xl  (1280px) — leaderboards, tables, grids, hero data
 *
 * Padding is `px-4 sm:px-6 lg:px-8` everywhere (Tailwind UI convention).
 *
 * Use the `as` prop to set the wrapper element (defaults to `<section>`).
 */

type SectionVariant = "prose" | "content" | "wide";

const WIDTH_BY_VARIANT: Record<SectionVariant, string> = {
  prose: "max-w-3xl",
  content: "max-w-5xl",
  wide: "max-w-7xl",
};

interface SectionProps {
  variant?: SectionVariant;
  as?: ElementType;
  className?: string;
  /**
   * Vertical padding / background / borders applied to the OUTER wrapper.
   * Use this for full-bleed backgrounds + section rhythm.
   * Inner container is always centered with the variant width + horizontal padding.
   */
  outerClassName?: string;
  children: ReactNode;
}

export function Section({
  variant = "content",
  as: Tag = "section",
  className,
  outerClassName,
  children,
}: SectionProps) {
  const widthClass = WIDTH_BY_VARIANT[variant];
  const outer = outerClassName ?? "";
  const inner = `mx-auto w-full ${widthClass} px-4 sm:px-6 lg:px-8 ${className ?? ""}`.trim();
  return (
    <Tag className={outer}>
      <div className={inner}>{children}</div>
    </Tag>
  );
}
