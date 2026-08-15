import { FeatureStatsSidebar } from "@/components/feature-stats/feature-stats-sidebar";

const BASE_PATH = "/feature-stats/sales-cold-email-outreach";

/**
 * Two sidebars: the Platform one (drawn by `ContextSidebar` in the dashboard
 * shell, since this route's nav level is `app`) plus this feature's own sub-nav
 * to its right. The page body is the third column.
 *
 * A server passthrough on purpose — `loading.tsx` cannot show a fallback for a
 * layout that reads `cookies()`/`headers()`, and the sidebar it renders is a
 * client component that reads the pathname itself.
 */
export default function FeatureStatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row flex-1 h-full">
      <FeatureStatsSidebar basePath={BASE_PATH} title="Sales Cold Emails" />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
