import { MATURITY_STYLES, type Maturity } from "@/lib/feature-gates";

/**
 * Small pill marking a non-GA surface (`alpha` / `beta`). Rendered only next to
 * surfaces a viewer can actually see — and since alpha/beta surfaces are hidden
 * from everyone else, in practice only staff/beta viewers ever see the badge.
 */
export function MaturityBadge({ level }: { level: Maturity }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium ${MATURITY_STYLES[level]}`}
    >
      {level}
    </span>
  );
}
