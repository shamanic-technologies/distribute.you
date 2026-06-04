// TEMPORARY sample data for the revenue overview UI.
//
// Drives real numbers through the `revenue.ts` calc lib so the page + Vercel
// preview show the true UX while features-service builds `GET /v1/features/{slug}/revenue`.
// REPLACE this whole module with an adapter over that endpoint (verify the wire
// shape via api-registry, `safeParse`) once it deploys — nothing else in the page
// or components needs to change (they consume `RevenueOverview` from revenue-view).

import {
  salesFunnel,
  personExpectedRevenueUsd,
  orgExpectedRevenue,
  cumulativeSeries,
  totalPipelineUsd,
  type SalesEconomics,
  type PersonSignals,
} from "./revenue";
import type {
  RevenueOverview,
  ConversionLead,
  ConversionOrg,
  ConversionEvent,
} from "./revenue-view";

// Representative sales economics (LTR $4,800; click ≈ $96, positive reply ≈ $420 of pipeline).
const SAMPLE_ECONOMICS: SalesEconomics = {
  lifetimeRevenueUsd: 4800,
  visitToClosePct: 2,
  visitToMeetingPct: 8,
  meetingToClosePct: 25,
  replyToMeetingPct: 35,
};

interface RawEvent {
  channel: "visit" | "reply";
  date: string; // ISO
}
interface RawPerson {
  personId: string;
  firstName: string;
  lastName: string;
  events: RawEvent[];
}
interface RawOrg {
  orgId: string;
  orgName: string;
  orgLogoUrl: string | null;
  people: RawPerson[];
}

// 6 orgs, mixed channels/people/dates across ~3 months.
const SAMPLE_ORGS: RawOrg[] = [
  {
    orgId: "o-acme",
    orgName: "Acme Robotics",
    orgLogoUrl: null,
    people: [
      { personId: "p-1", firstName: "Dana", lastName: "Okafor", events: [{ channel: "reply", date: "2026-03-18" }, { channel: "visit", date: "2026-03-12" }] },
      { personId: "p-2", firstName: "Marc", lastName: "Lefebvre", events: [{ channel: "visit", date: "2026-03-10" }] },
    ],
  },
  {
    orgId: "o-northwind",
    orgName: "Northwind Labs",
    orgLogoUrl: null,
    people: [
      { personId: "p-3", firstName: "Priya", lastName: "Nair", events: [{ channel: "reply", date: "2026-04-02" }] },
    ],
  },
  {
    orgId: "o-globex",
    orgName: "Globex",
    orgLogoUrl: null,
    people: [
      { personId: "p-4", firstName: "Tomás", lastName: "Rivera", events: [{ channel: "visit", date: "2026-02-20" }] },
      { personId: "p-5", firstName: "Wei", lastName: "Chen", events: [{ channel: "visit", date: "2026-02-28" }] },
    ],
  },
  {
    orgId: "o-initech",
    orgName: "Initech",
    orgLogoUrl: null,
    people: [
      { personId: "p-6", firstName: "Sofia", lastName: "Bianchi", events: [{ channel: "reply", date: "2026-04-15" }, { channel: "visit", date: "2026-04-10" }] },
    ],
  },
  {
    orgId: "o-umbrella",
    orgName: "Umbrella Health",
    orgLogoUrl: null,
    people: [
      { personId: "p-7", firstName: "Jamal", lastName: "Haddad", events: [{ channel: "visit", date: "2026-03-30" }] },
    ],
  },
  {
    orgId: "o-hooli",
    orgName: "Hooli",
    orgLogoUrl: null,
    people: [
      { personId: "p-8", firstName: "Grace", lastName: "Lindqvist", events: [{ channel: "reply", date: "2026-04-22" }] },
      { personId: "p-9", firstName: "Owen", lastName: "Mbeki", events: [{ channel: "reply", date: "2026-04-20" }] },
    ],
  },
];

/** Build a fully-computed RevenueOverview from the sample orgs via the calc lib. */
export function sampleRevenueOverview(): RevenueOverview {
  const cfg = salesFunnel(SAMPLE_ECONOMICS);

  // Collapse each raw person to PersonSignals (unique channels + most-advanced date).
  const personSignals = (p: RawPerson): PersonSignals => ({
    personId: p.personId,
    channels: [...new Set(p.events.map((e) => e.channel))],
    eventDate: p.events.reduce<string | null>(
      (max, e) => (max === null || e.date > max ? e.date : max),
      null,
    ),
  });

  const leads: ConversionLead[] = [];
  const orgs: ConversionOrg[] = [];
  const events: ConversionEvent[] = [];

  for (const org of SAMPLE_ORGS) {
    const signals = org.people.map(personSignals);
    const rollup = orgExpectedRevenue(org.orgId, signals, cfg);

    // Per-person lead rows (with org context).
    const orgLeads: ConversionLead[] = org.people.map((p) => {
      const sig = personSignals(p);
      return {
        personId: p.personId,
        firstName: p.firstName,
        lastName: p.lastName,
        photoUrl: null,
        orgId: org.orgId,
        orgName: org.orgName,
        orgLogoUrl: org.orgLogoUrl,
        channels: sig.channels,
        expectedRevenueUsd: personExpectedRevenueUsd(sig, cfg),
        eventDate: sig.eventDate ?? null,
      };
    });
    leads.push(...orgLeads);

    orgs.push({
      orgId: org.orgId,
      orgName: org.orgName,
      orgLogoUrl: org.orgLogoUrl,
      topLead: orgLeads.find((l) => l.personId === rollup.topPersonId) ?? null,
      channels: rollup.channels,
      expectedRevenueUsd: rollup.expectedRevenueUsd,
      mostAdvancedDate: rollup.mostAdvancedDate,
    });

    // Raw event rows.
    for (const p of org.people) {
      for (const ev of p.events) {
        events.push({
          eventId: `${p.personId}-${ev.channel}-${ev.date}`,
          personId: p.personId,
          firstName: p.firstName,
          lastName: p.lastName,
          photoUrl: null,
          orgName: org.orgName,
          orgLogoUrl: org.orgLogoUrl,
          channel: ev.channel,
          eventDate: ev.date,
          contributionUsd: cfg.lifetimeRevenueUsd * (cfg.channelProbabilities[ev.channel] ?? 0),
        });
      }
    }
  }

  const { points, undatedPipelineUsd } = cumulativeSeries(orgs.map((o) => ({
    orgId: o.orgId,
    expectedRevenueUsd: o.expectedRevenueUsd,
    topPersonId: o.topLead?.personId ?? null,
    mostAdvancedDate: o.mostAdvancedDate,
    channels: o.channels,
  })));

  // Sort the tables most-valuable-first; events most-recent-first.
  orgs.sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd);
  leads.sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd);
  events.sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1));

  return {
    totalPipelineUsd: totalPipelineUsd(orgs.map((o) => ({
      orgId: o.orgId,
      expectedRevenueUsd: o.expectedRevenueUsd,
      topPersonId: null,
      mostAdvancedDate: o.mostAdvancedDate,
      channels: o.channels,
    }))),
    series: points,
    undatedPipelineUsd,
    orgs,
    leads,
    events,
  };
}
