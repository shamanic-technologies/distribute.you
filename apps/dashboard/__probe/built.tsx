import { createRoot } from "react-dom/client";
import { BuiltSummaryPanel } from "@/components/onboarding/built-summary-panel";
import { LegMark } from "@/components/marks/leg-mark";
const campaigns = [
  { key: "a", label: "Positive reply", channelName: "Sales Cold Email Outreach", from: null, to: "conversation" },
  { key: "b", label: "Positive reply → Meeting booked", channelName: "AI Meeting Booking", from: "conversation", to: "meeting_booked" },
];
createRoot(document.getElementById("root")!).render(
  <div className="mx-auto max-w-xl p-6"><BuiltSummaryPanel
    input={{ services: ["Physician dinner events", "Speaker bureaus"], campaigns, targetAudience: "Practice owners of multi-site dental groups in the US.", levers: [{ key: "dreamOutcome", label: "Dream outcome", value: "A full calendar of qualified physician meetings." }] }}
    campaignMarks={{ a: <LegMark fromKey={null} toKey="conversation" size="sm" />, b: <LegMark fromKey="conversation" toKey="meeting_booked" size="sm" /> }} /></div>);
