import { redirect } from "next/navigation";

/**
 * The feature's base path has no page of its own — Economics and Cost details
 * are cold-email-shaped and do not exist here, so the base path resolves to the
 * one sub-page this feature carries.
 */
export default function AiMeetingBookingStatsPage() {
  redirect("/feature-stats/ai-meeting-booking/workflows");
}
