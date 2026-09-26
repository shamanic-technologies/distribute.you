import { buildControlRows } from "../src/lib/campaign-controls";
import { acquisitionChannelsFromFeatures } from "../src/lib/acquisition-channels";
import campaigns from "./campaigns.json";
import budgets from "./budgets.json";
import features from "./features.json";
const channels = acquisitionChannelsFromFeatures((features as any).features);
const b = { campaigns: (budgets as any).campaigns.map((c: any) => ({ ...c, dailyBudgetCents: Number(c.dailyBudgetCents) })) };
const rows = buildControlRows((campaigns as any).campaigns, b as any, channels, { offerId: "d5ecba00-783a-4939-b5bd-f85b9e6b7d9e" },
  [{ legKey: "start_to_conversation", featureSlug: "sales-cold-email-outreach", channelName: "Cold", offerId: "d5ecba00-783a-4939-b5bd-f85b9e6b7d9e" },
   { legKey: "conversation_to_meeting_booked", featureSlug: "ai-meeting-booking", channelName: "AI", offerId: "d5ecba00-783a-4939-b5bd-f85b9e6b7d9e" }]);
console.log(rows.map((r: any) => ({ id: r.rowId, running: r.running, campaignId: r.campaignId, saved: r.savedCents })));
console.log(channels.map((c: any) => c.featureSlug + ":" + (c as any).operatedBy).join(" "));
