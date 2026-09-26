// Whether a campaign (an offer's leg on one channel) is RUNNING, and what it takes to
// change that.
//
// Money and status are two independent facts about one channel: billing holds the
// ceiling, campaign-service holds the word. Funding a channel used to be enough to
// start it, because campaign-service provisioned a campaign for any funded pair on
// its own tick. That is DELETED (campaign-service, 2026-09-06: "money starts
// nothing"), and its own doc states the consequence in full:
//
//   "A brand that funds a channel and has no campaign for it simply has no campaign
//    for it, and the honest answer to 'why isn't it running' is 'nobody launched it'."
//
// So a funded channel with no campaign is NOT_STARTED, forever, until a person
// starts it. That is the state this module exists to name, and the reason Offer
// Settings grew a status control: before it, a customer could fund every channel, press Update, and watch nothing happen with no way to act.
//
// Only relative value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

/**
 * What one (leg, channel) of an offer is DOING.
 *
 * `not_started` is a real fourth state and is the whole point: a channel the brand
 * has funded and nobody has launched is neither running nor paused. Calling it
 * "paused" tells a customer to look for a switch that was never flipped, and calling
 * it "running" is the lie this replaced.
 *
 * `unknown` is the honest reading while the campaigns read is in flight. Guessing
 * either way there is a verdict we do not have.
 */
export type ChannelRunState = "running" | "paused" | "not_started" | "unknown";

/**
 * The state, from campaign-service's own word plus the presence of a campaign.
 *
 * `campaignId` is `buildControlRows`' answer: the campaign a status write can
 * ADDRESS, null for a channel that has none. It is never derived from the ceiling,
 * which is exactly the drift that put "Running" on one screen and "Paused" on
 * another for the same channel at the same moment.
 */
export function channelRunState(input: {
  /** Both reads resolved or errored. False means the answer is not in yet. */
  settled: boolean;
  /** The campaign a status write targets, or null when the channel has none. */
  campaignId: string | null;
  /** campaign-service reports at least one member campaign running. */
  running: boolean;
}): ChannelRunState {
  if (!input.settled) return "unknown";
  if (input.campaignId === null) return "not_started";
  return input.running ? "running" : "paused";
}

/** One word per state, as the customer reads it. `unknown` draws a skeleton. */
export const CHANNEL_RUN_STATE_LABEL: Record<ChannelRunState, string> = {
  running: "Running",
  paused: "Paused",
  not_started: "Not started",
  unknown: "",
};

/**
 * Why this channel cannot be turned ON right now, or null when it can.
 *
 * A campaign with no ceiling does not send: campaign-service holds it on the funding
 * gate every tick, so starting one would produce a campaign that exists and does
 * nothing, which is the state this whole surface exists to remove. The customer is
 * told to fund it rather than being handed a switch that silently achieves nothing.
 *
 * Only ever blocks turning ON. Pausing is always available, including on a channel
 * funded at zero: stopping something is never refused for want of money.
 */
export function channelStartBlocker(input: {
  state: ChannelRunState;
  /** What the FORM currently holds for this channel, in cents, as typed. */
  typedCents: number;
}): string | null {
  if (input.state === "unknown" || input.state === "running") return null;
  if (input.typedCents > 0) return null;
  return "Give this channel a daily budget first. A campaign with no ceiling never sends.";
}

/** One channel's pending status change, for the sentence below. */
export interface ChannelStatusMove {
  channelName: string;
  /** `start` creates the campaign; `restart` flips one that already exists. */
  kind: "start" | "restart" | "pause";
}

/**
 * What Save is about to do to the channels whose switch moved, said BEFORE it does
 * it.
 *
 * Starting or restarting FIRES THE WORKFLOW IMMEDIATELY (campaign-service runs
 * `executeCampaignWorkflow` + `wakeScheduler` on an activate, and a create through
 * this route hands the row back started), so it spends now rather than at the next
 * daily tick. A customer who thought they were scheduling something for tomorrow has
 * to read that here, not discover it in their billing.
 *
 * Pausing says the ceiling is KEPT, because the alternative a customer would
 * otherwise reach for is emptying the amount, and that one is not free to undo:
 * billing's per-channel floor only lets a channel funded under its minimum be kept or
 * raised, so a channel grandfathered under the floor and defunded could never be
 * funded back at the figure it was running.
 */
export function channelStatusSummary(moves: readonly ChannelStatusMove[]): string | null {
  if (moves.length === 0) return null;
  const on = moves.filter((m) => m.kind !== "pause");
  const off = moves.filter((m) => m.kind === "pause");
  const parts: string[] = [];
  if (on.length > 0) {
    parts.push(
      `Starting ${nameList(on.map((m) => m.channelName))} now: ${
        on.length === 1 ? "it begins" : "they begin"
      } sending immediately, not at the next daily tick.`,
    );
  }
  if (off.length > 0) {
    parts.push(
      `Pausing ${nameList(off.map((m) => m.channelName))}. ${
        off.length === 1 ? "Its daily budget is" : "Their daily budgets are"
      } kept, so starting again is one click.`,
    );
  }
  return parts.join(" ");
}

/** `a`, `a and b`, `a, b and c`. Never a trailing "and" on a single name. */
function nameList(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!}`;
}

/**
 * A refusal WE raise before any request goes out, carrying the sentence to show.
 *
 * Distinct from a downstream error so the message survives to the screen rather than
 * being flattened into one generic line: "this channel has no workflow ready yet" is
 * actionable and "we could not start this channel" is not.
 */
export class ChannelStartRefusal extends Error {
  readonly channelStartRefusal = true;
  constructor(message: string) {
    super(message);
    this.name = "ChannelStartRefusal";
  }
}

/**
 * What to put in front of the user for ANY failed status write.
 *
 * Our own refusal passes through verbatim; everything else is keyed on the STATUS,
 * never on `err.message` (`apiCall` sets that to the whole downstream body, and the
 * api-service campaign proxy flattens campaign-service's body into an `error` string,
 * so printing it puts a JSON blob in front of a customer).
 *
 * Duck-typed on `status` and on the refusal marker so this module needs no runtime
 * import and stays unit-testable.
 */
export function channelWriteErrorMessage(err: unknown, kind: "start" | "pause"): string {
  const refusal = (err as { channelStartRefusal?: unknown } | null)?.channelStartRefusal;
  if (refusal === true) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 400);
  }
  const status = (err as { status?: unknown } | null)?.status;
  return channelStartErrorMessage(typeof status === "number" ? status : null, kind);
}

/**
 * Our own sentence for a refused status write, keyed on the STATUS.
 *
 * The 400 on a START is its own sentence because it has its own cause: campaign-service
 * validates the workflow's tracking headers and refuses a sales campaign that states no
 * leg, so a refusal there is about the channel being unrunnable rather than about
 * anything the customer typed. Naming the amount would send them to re-type a number
 * that was never the problem.
 */
export function channelStartErrorMessage(status: number | null, kind: "start" | "pause"): string {
  if (kind === "pause") {
    if (status === 403) return "You do not have access to this campaign.";
    if (status === 404) return "This campaign no longer exists.";
    return "We could not pause this channel. Try again in a moment.";
  }
  if (status === 400) {
    return "We could not start this channel. It may not be ready to run for this outcome yet.";
  }
  if (status === 402) {
    return "Your credit balance is too low to start a channel. Top up and try again.";
  }
  if (status === 403) return "You do not have access to this brand's campaigns.";
  return "We could not start this channel. Try again in a moment.";
}

/**
 * Whether a channel we are about to start has a workflow to run.
 *
 * features-service ranks the channel's workflows for the leg and names its own
 * pick (`recommendedWorkflowDynastySlug`, an argmin over MEASURED rows). A channel it
 * cannot name one for has nothing to run, so the create is refused HERE rather than
 * being sent with a slug of our own choosing: which workflow serves a campaign is the
 * producer's answer, and a dashboard that picks one is a second opinion over it.
 *
 * Null is therefore a REFUSAL, never a licence to default.
 */
export function startableWorkflowDynastySlug(
  recommended: string | null | undefined,
): string | null {
  const slug = recommended?.trim();
  return slug ? slug : null;
}
