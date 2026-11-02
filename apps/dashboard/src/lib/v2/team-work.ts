import { z } from "zod";

/**
 * The "Done by your team" page (FACTORY-P4-PAGES): the work the client's OWN team performs,
 * one card per outcome the team makes for the offer (meetings attended, clients closed...). Who waits
 * before each outcome and how many the team moved per week are lead-service's (its queue read by from
 * and to outcome, through the gateway's `/v1/leads/:id` passthrough); who performs the work is the
 * catalogue's. Nothing here
 * counts or dates a person. Alias-free (real unit tests).
 */

export const PipeQueueSchema = z
  .object({
    brandId: z.string(),
    from: z.string(),
    to: z.string(),
    fromState: z.string().nullable(),
    toState: z.string().nullable(),
    unservedReason: z.string().nullable(),
    waitingCount: z.number(),
    waiting: z.array(
      z
        .object({
          leadId: z.string(),
          campaignLeadId: z.string().nullable(),
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
          name: z.string().nullable(),
          title: z.string().nullable(),
          orgName: z.string().nullable(),
          orgDomain: z.string().nullable(),
          photoUrl: z.string().nullable(),
          waitingSince: z.string().nullable(),
          causedByOutreach: z.boolean().nullable(),
        })
        .passthrough(),
    ),
    throughput: z.array(z.object({ week: z.string(), moved: z.number() }).passthrough()),
  })
  .passthrough();
export type PipeQueue = z.infer<typeof PipeQueueSchema>;
export type PipeQueuePerson = PipeQueue["waiting"][number];

/** The pipe-queue read's query string. */
export function pipeQueueQuery(brandId: string, from: string, to: string): string {
  return new URLSearchParams({ brandId, from, to }).toString();
}

/** What the page needs of one running part of a campaign: the two outcomes it links and who performs it. */
export interface TeamOutcomeSource {
  running: boolean;
  operatedBy: string | null;
  fromKey: string | null;
  fromLabel: string | null;
  toKey: string;
  toLabel: string;
}

/** An outcome the client's own team makes, and the outcome its people wait at before it. */
export interface TeamOutcome {
  fromKey: string;
  fromLabel: string;
  toKey: string;
  toLabel: string;
}

/**
 * The outcomes the client's team makes for the offer (GTM Factory: a script "Performed by" the client's team): a
 * RUNNING part whose channel the catalogue says the customer operates, from an outcome (Start has nobody waiting).
 * One per outcome pair, in the order the campaigns come; no pipe is named (owner 2026-11-02).
 */
export function teamOutcomes(campaigns: readonly TeamOutcomeSource[]): TeamOutcome[] {
  const out = new Map<string, TeamOutcome>();
  for (const c of campaigns) {
    if (!c.running || c.operatedBy !== "customer" || !c.fromKey) continue;
    const key = `${c.fromKey}>${c.toKey}`;
    if (out.has(key)) continue;
    out.set(key, { fromKey: c.fromKey, fromLabel: c.fromLabel ?? c.fromKey, toKey: c.toKey, toLabel: c.toLabel });
  }
  return [...out.values()];
}

/** A waiting person's name as served: first + last, else the full name, else their company. */
export function personName(p: Pick<PipeQueuePerson, "firstName" | "lastName" | "name" | "orgName">): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || p.orgName || "Unknown";
}
