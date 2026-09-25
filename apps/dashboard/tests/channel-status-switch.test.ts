import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const CARD = read("components/settings/brand-sales-funnels-card.tsx");
const CONTROLS = read("lib/campaign-controls.ts");

/** Slice from an anchor to the NEXT declaration, so the bound moves with the file. */
function sliceBetween(haystack: string, anchor: string, until: string): string {
  const at = haystack.indexOf(anchor);
  expect(at, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
  const end = haystack.indexOf(until, at + anchor.length);
  expect(end, `bound not found: ${until}`).toBeGreaterThan(at);
  return haystack.slice(at, end);
}

// The bug this whole surface exists for: a customer declared a funnel, funded every
// channel of it, pressed Update, and nothing ever ran. Everything they did landed
// (brand-service held the declaration, billing held both ceilings) and campaign-service
// held no campaign at all for the offer, because provisioning-from-a-funded-ceiling was
// deleted on 2026-09-06. The card could neither show that nor act on it.
describe("money never decides that something runs", () => {
  // THE regression, and the one that made two screens contradict each other: production
  // read `Running` on the funnel board at the same moment Offer Settings read `Paused`
  // for the same offer, the same funnel and the same channel, with neither true.
  it("gives a campaign-less row running:false, never a ceiling test", () => {
    const offered = sliceBetween(CONTROLS, "const offeredRows: ControlRow[] = [];", "return [...groups");
    expect(offered).toContain("running: false,");
    expect(offered).not.toContain("running: savedCents > 0");
  });

  it("keeps the ceiling out of every running verdict in the resolver", () => {
    expect(CONTROLS).not.toContain("running: savedCents > 0");
  });

  // A status write addresses a campaign. Null is what makes the switch a CREATE.
  it("still states which campaign a status write can address", () => {
    expect(CONTROLS).toContain("campaignId: string | null;");
  });
});

describe("the Sales Funnels card carries a per-channel status switch", () => {
  // The card is the surface that had no way to say what was happening or to change it.
  it("reads campaign-service on the key every campaign surface already polls", () => {
    expect(CARD).toContain('["campaigns", brandId]');
    expect(CARD).toContain("listCampaignsByBrand(brandId)");
  });

  // ONE resolver. A second copy of "is this running" is how the board and this card
  // came to state opposite words for one channel.
  it("resolves the state through the shared resolver, never its own rule", () => {
    expect(CARD).toContain("buildControlRows(");
    expect(CARD).toContain("channelRunState(");
    // Never re-derived from money.
    const runState = sliceBetween(CARD, "function runStateOf(", "function statusMovesFor(");
    expect(runState).not.toContain("savedCents");
    expect(runState).not.toContain("budgetUsd");
  });

  // `offerable` is what makes a channel with NO campaign appear at all: without it the
  // channel someone opens this card to turn on is invisible by construction.
  it("passes offerable, so an unlaunched channel has a row", () => {
    expect(CARD).toContain("const offerable: OfferableChannel[]");
    expect(CARD).toContain("offerable,");
  });

  it("renders a switch per channel, and a skeleton while the read is unsettled", () => {
    expect(CARD).toContain('role="switch"');
    expect(CARD).toContain('runState === "unknown" ? (');
    expect(CARD).toContain("<Skeleton");
  });

  // A switch sitting in the drafted position while reading the SAVED word is one
  // control saying two things.
  it("labels the switch with what it will BE once Save lands", () => {
    expect(CARD).toContain("nextRunning === savedRunning");
    expect(CARD).toContain("CHANNEL_RUN_STATE_LABEL[runState]");
  });
});

describe("Update writes fields and money; the switch writes status; one Save commits both", () => {
  // The separation the customer asked for: editing a rate must never touch what runs.
  it("diffs the switches LIVE against campaign-service, never a sticky flag", () => {
    const moves = sliceBetween(CARD, "function statusMovesFor(", "function confirm(");
    expect(moves).toContain("if (next === saved) continue;");
    // Nothing moves while the baseline is unknown: a draft built against a baseline we
    // do not have would write a status nobody chose.
    expect(moves).toContain("if (!campaignsSettled) return [];");
  });

  // A CREATE and a status flip are different writes, and which one fires is decided by
  // whether a campaign exists, never by the money.
  it("separates a create from a status flip on the campaign's presence", () => {
    const moves = sliceBetween(CARD, "function statusMovesFor(", "function confirm(");
    expect(moves).toContain('state.campaignIdByChannel[slug] ? "restart" : "start"');
  });

  it("commits the status inside confirm, before the nothing-changed exit", () => {
    const confirm = sliceBetween(
      CARD,
      "function confirm(def: SalesFunnelDef) {",
      "function removeFunnel(",
    );
    const status = confirm.indexOf("statusMutation.mutate");
    const exit = confirm.indexOf("isEmptyFunnelPatch(body)");
    expect(status).toBeGreaterThan(-1);
    expect(exit).toBeGreaterThan(status);
  });

  // Starting a channel with no ceiling produces a campaign campaign-service holds on the
  // funding gate every tick: it exists and never sends, which is the state this whole
  // surface exists to remove.
  it("refuses a start with no daily budget rather than sending it", () => {
    const confirm = sliceBetween(
      CARD,
      "function confirm(def: SalesFunnelDef) {",
      "function removeFunnel(",
    );
    expect(confirm).toContain("channelStartBlocker({");
    const blocker = confirm.indexOf("channelStartBlocker({");
    const statusWrite = confirm.indexOf("statusMutation.mutate");
    expect(blocker).toBeLessThan(statusWrite);
  });

  // Starting FIRES THE WORKFLOW IMMEDIATELY rather than at the next daily tick, so the
  // customer reads it here and not in their billing.
  it("says what Save is about to do, at the CALL SITE", () => {
    expect(CARD).toContain("channelStatusSummary(");
    expect(CARD).toContain("{statusSummary && <p");
  });
});

describe("the row fits a phone, and the closed card names the fourth state", () => {
  // Measured at 412px BEFORE stacking: the name had 33px left and every channel read
  // "Sales ...", "AI ...", "Yo..." — the identity of the row destroyed to make room for
  // the controls that act on it. Every guard was green; only rendering it showed this.
  it("stacks the channel row below sm: so the name keeps the full width", () => {
    expect(CARD).toContain(
      'className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"',
    );
    // The amount and the switch share the line below the name on a phone, and rejoin it
    // from `sm:` up.
    expect(CARD).toContain('<div className="flex items-center justify-end gap-3">');
  });

  // "Paused" on a funnel that has never had a campaign sends a customer looking for a
  // switch that was never flipped.
  it("tells a never-launched funnel apart from a stopped one, on the CAMPAIGN", () => {
    expect(CARD).toContain('{funnelHasAnyCampaign ? "Paused" : "Not started"}');
    const derive = sliceBetween(CARD, "const funnelHasAnyCampaign =", ";");
    expect(derive).toContain("campaignIdByChannel");
    // Never the money.
    expect(derive).not.toContain("Cents");
  });
});

describe("the create is campaign-service's, and the workflow is the producer's", () => {
  it("starts an unlaunched channel through POST /campaigns", () => {
    expect(CARD).toContain("startFunnelChannelCampaign({");
    const api = read("lib/api.ts");
    const fn = sliceBetween(api, "export async function startFunnelChannelCampaign(", "\n}\n");
    expect(fn).toContain('apiCall<{ campaign: RawCampaign }>("/campaigns"');
    // A sales campaign's money is billing's; campaign-service 400s one that states a
    // per-campaign ceiling.
    expect(fn).not.toContain("maxBudget");
  });

  // Which workflow serves a campaign is features-service's answer. A dashboard that
  // picks one when the producer names none is a second opinion over it.
  it("refuses rather than inventing a workflow when the producer names none", () => {
    expect(CARD).toContain("startableWorkflowDynastySlug(");
    expect(CARD).toContain("ChannelStartRefusal(");
  });

  // `funnel`, never `goal`: the two meeting funnels both echo `meetingBooked`, so a
  // goal-keyed request prices and RANKS across both at once.
  it("asks the ladder on the FUNNEL", () => {
    const mutation = sliceBetween(CARD, "const statusMutation = useMutation({", "const undeclareMutation");
    expect(mutation).toContain("funnel: vars.def.key,");
    expect(mutation).not.toContain("goal:");
  });

  // Whether a channel runs moves the running total, the campaign rows and every figure
  // derived from them.
  it("re-reads every campaign surface after a status write", () => {
    const mutation = sliceBetween(CARD, "const statusMutation = useMutation({", "const undeclareMutation");
    expect(mutation).toContain("invalidateCampaignMoney(queryClient)");
    // ...and re-seeds the switches from campaign-service's own answer.
    expect(mutation).toContain("seededStatusFrom.current = null");
  });

  // NEVER `err.message`: apiCall sets it to the whole downstream body, and the
  // api-service campaign proxy flattens campaign-service's body into an `error` string.
  it("shows our own sentence for a refusal, never the downstream body", () => {
    expect(CARD).toContain("channelWriteErrorMessage(err,");
    const mutation = sliceBetween(CARD, "const statusMutation = useMutation({", "const undeclareMutation");
    expect(mutation).not.toContain("err.message");
  });
});
