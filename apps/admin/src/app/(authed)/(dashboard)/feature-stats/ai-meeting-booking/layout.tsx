import { FeatureStatsSidebar } from "@/components/feature-stats/feature-stats-sidebar";

const BASE_PATH = "/feature-stats/ai-meeting-booking";

/**
 * Two sidebars, same shape as the cold-email feature: the Platform one (drawn by
 * `ContextSidebar`, since this route's nav level is `app`) plus this feature's
 * own sub-nav to its right.
 *
 * Only `Workflow` is listed. Economics and Cost details read the cross-org
 * cold-email endpoints (cost per positive reply / per website visit) and have no
 * page here, so listing them would be a nav row pointing at a 404.
 */
export default function AiMeetingBookingStatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row flex-1 h-full">
      <FeatureStatsSidebar basePath={BASE_PATH} title="AI Meeting Booking" nav={["workflows"]} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
