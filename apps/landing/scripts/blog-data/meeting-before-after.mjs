// Does the AI that answers a positive reply book more meetings than before it went live? One
// study of the Meeting booked OUTCOME section, written from lead-service's own before/after read
// (`GET /internal/meeting-attribution/before-after`, extract.sh -> meeting-before-after.json).
//
// Every figure is lead-service's: the go-live (the brand's FIRST AI Meeting Booking act, never a
// creation date), who sits before or after (the day of their FIRST positive reply), who booked
// and the rate. Nothing is re-derived here; this module only places the served counts on bars,
// writes the words and asks verdict.mjs what the gap can carry.
//
// The headline is the SAME-HORIZON read (`withinDays`: a meeting counts when booked within N days
// of the positive reply, on people whose reply is at least N days old), so both sides had the same
// time to book. All-time is context only: the after side has had less time to book by construction.
// A brand whose go-live is unknown (no AI Meeting Booking act yet) is outside both sides; the
// population line counts it.
//
// Pure: no I/O, so tests/unit/research-meeting-before-after.test.ts runs it on fixtures.
import { compareVerdict } from "./verdict.mjs";

const LEG = "conversation_to_meeting_booked";
const n = (v) => Number(v).toLocaleString("en-US");
const people = (k) => `${n(k)} ${k === 1 ? "person" : "people"}`;
const meetingsText = (k) => `${n(k)} ${k === 1 ? "meeting" : "meetings"}`;
const brandsText = (k) => `${n(k)} ${k === 1 ? "brand" : "brands"}`;
const pct = (rate) => `${(rate * 100).toFixed(0)}%`;

/**
 * @param {object} input
 * @param {object} input.read lead-service's before/after body (fleet + brands)
 * @param {{legKey:string,outcomesRequired:number}[]} input.maturity
 */
export function meetingBeforeAfterStudy({ read, maturity }) {
  if (read.legKey !== LEG) throw new Error(`meeting-before-after.json: leg ${read.legKey}, expected ${LEG}`);
  const fleet = read.fleet;
  if (!fleet) throw new Error("meeting-before-after.json carries no fleet block");
  const rule = maturity.find((l) => l.legKey === LEG);
  if (!rule) throw new Error(`maturity.json carries no rule for leg ${LEG}: features-service's /public/channels must state it`);
  const days = read.horizonDays;
  const live = read.brands.filter((b) => b.goLive);
  const unknown = read.brands.filter((b) => !b.goLive && b.positiveReplyPeople > 0);
  if (live.length !== fleet.brands) throw new Error(`meeting-before-after.json: fleet says ${fleet.brands} brands, ${live.length} carry a go-live`);

  const side = (label, s, horizon) => {
    const w = horizon ? s.withinDays : s;
    return { label, people: w.people, booked: w.booked, rate: w.rate, by: horizon ? null : s.bookedBy };
  };
  const byText = (by) => by ? ` (AI ${n(by.aiMeetingBooking)} · your team ${n(by.yourTeamMeetingBooking)} · unknown ${n(by.unknown)}${by.other ? ` · other ${n(by.other)}` : ""})` : "";
  const point = (s) => ({
    label: s.label,
    value: s.rate === null ? 0 : Number((s.rate * 100).toFixed(1)),
    display: s.rate === null ? "No one yet" : pct(s.rate),
    note: `${meetingsText(s.booked)} booked of ${people(s.people)} with a positive reply${byText(s.by)}`,
    thin: s.booked < rule.outcomesRequired,
  });
  // the leader first (verdict.mjs: the first bar stays the leader); a tie keeps Before first
  const ordered = (a, b) => ((b.rate ?? -1) > (a.rate ?? -1) ? [b, a] : [a, b]);

  const before = side("Before the AI went live", fleet.before, true);
  const after = side("After the AI went live", fleet.after, true);
  const allBefore = side("Before the AI went live", fleet.before, false);
  const allAfter = side("After the AI went live", fleet.after, false);

  const [lead, runner] = ordered(before, after);
  const verdict = !before.people || !after.people
    ? { kind: "noise", reason: `No positive reply on the ${!after.people ? "after" : "before"} side is ${days} days old yet: nothing to compare on the same horizon.` }
    : compareVerdict({
        a: { label: lead.label, outcomes: lead.booked, emails: lead.people },
        b: { label: runner.label, outcomes: runner.booked, emails: runner.people },
        goal: "rate", comparisons: 1, noun: "meeting", nouns: "meetings", per: "per person with a positive reply",
      });

  const horizonLine = `${before.label}: ${before.rate === null ? "no one yet" : pct(before.rate)} (${meetingsText(before.booked)} of ${people(before.people)}). ${after.label}: ${after.rate === null ? `no positive reply ${days} days old yet` : pct(after.rate)}${after.people ? ` (${meetingsText(after.booked)} of ${people(after.people)})` : ""}.`;
  const headline = verdict.kind === "conclusion"
    ? `${lead.label === after.label ? "More" : "Fewer"} meetings booked within ${days} days of a positive reply since the AI went live: ${horizonLine}`
    : `Within ${days} days of a positive reply. ${horizonLine} ${verdict.kind === "signal" ? "A signal to confirm, not yet a conclusion." : "Noise so far."}`;

  const population = `${brandsText(live.length)} with the AI live, each split at its own go-live (the day the AI first answered one of its prospects). A person counts on the side of their first positive reply.${unknown.length ? ` ${brandsText(unknown.length)} with positive replies but no AI answer yet ${unknown.length === 1 ? "stays" : "stay"} out (${people(unknown.reduce((t, b) => t + b.positiveReplyPeople, 0))}).` : ""}`;
  const learning = `A figure needs ${meetingsText(rule.outcomesRequired)} behind it; below that it reads Learning.`;
  const lateBookers = fleet.before.bookedAfterGoLive;

  return {
    id: "meeting-ai-before-after",
    crew: null,
    outcome: "meeting",
    topic: "launch",
    goal: "rate",
    question: "Does the AI answering positive replies book more meetings?",
    status: before.people + after.people > 0 ? "measured" : "not_enough_data",
    headline,
    winner: verdict.kind === "conclusion" ? lead.label : null,
    crowned: verdict.kind === "conclusion",
    verdict,
    // the card leads with the after side; until one of its replies is old enough, with the before side
    result: after.rate !== null
      ? { display: pct(after.rate), unit: `booked a meeting within ${days} days of a positive reply, after the AI went live`, sample: `${meetingsText(after.booked)} of ${people(after.people)} · before: ${before.rate === null ? "no one yet" : pct(before.rate)}` }
      : before.rate !== null
        ? { display: pct(before.rate), unit: `booked a meeting within ${days} days of a positive reply, before the AI went live`, sample: `${meetingsText(before.booked)} of ${people(before.people)} · after: no positive reply ${days} days old yet` }
        : null,
    charts: [
      {
        kind: "bars",
        title: `Meetings booked within ${days} days of a positive reply (%, higher is better)`,
        lowerIsBetter: false,
        points: ordered(before, after).map(point),
        note: `Same horizon on both sides: a person counts once their positive reply is ${days} days old, and a meeting counts when booked within those ${days} days. ${learning} ${population}`,
      },
      {
        kind: "bars",
        title: "Every meeting booked since the positive reply (%, context only)",
        lowerIsBetter: false,
        points: ordered(allBefore, allAfter).map(point),
        note: `Context, not the answer: people on the after side have had less time to book, so this read favours the before side. ${learning}`,
      },
    ],
    conclusion: [
      `We compare the share of people with a positive reply who booked a meeting, before and after the AI started answering them. The ${days}-day read gives both sides the same time to book; the all-time read is context.`,
      ...(lateBookers ? [`${people(lateBookers)} who replied before the go-live booked after it: they stay on the before side.`] : []),
      population,
    ],
  };
}
