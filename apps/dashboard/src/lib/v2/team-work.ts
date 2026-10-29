import { z } from "zod";

/**
 * The staff "Done by your team" page (FACTORY-P4-PAGES): the work the client's OWN team performs,
 * one card per pipe a channel operated by the customer runs for the offer (meetings to attend,
 * calls to close...). Who waits on each pipe and how many it moved per week are lead-service's
 * (`GET /orgs/leads/pipe-queue?brandId&from&to`, reached through the gateway's `/v1/leads/:id`
 * passthrough); the pipe, its leg and who operates its channel are the catalogue's. Nothing here
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

/** What the page needs of one campaign: its pipe, its leg's two steps, and who operates its channel. */
export interface TeamPipeSource {
  pipeId: string | null;
  pipeName: string;
  running: boolean;
  operatedBy: string | null;
  fromKey: string | null;
  fromLabel: string | null;
  toKey: string;
  toLabel: string;
}

export interface TeamPipe {
  pipeId: string;
  pipeName: string;
  fromKey: string;
  fromLabel: string;
  toKey: string;
  toLabel: string;
}

/**
 * The pipes the client's team works for the offer: a RUNNING campaign whose channel the catalogue
 * says the customer operates, on a leg with a from step (an entry leg has nobody waiting). One per
 * pipe, in the order the campaigns come.
 */
export function teamPipes(campaigns: readonly TeamPipeSource[]): TeamPipe[] {
  const out = new Map<string, TeamPipe>();
  for (const c of campaigns) {
    if (!c.running || c.operatedBy !== "customer" || !c.pipeId || !c.fromKey) continue;
    if (out.has(c.pipeId)) continue;
    out.set(c.pipeId, {
      pipeId: c.pipeId,
      pipeName: c.pipeName,
      fromKey: c.fromKey,
      fromLabel: c.fromLabel ?? c.fromKey,
      toKey: c.toKey,
      toLabel: c.toLabel,
    });
  }
  return [...out.values()];
}

/** A waiting person's name as served: first + last, else the full name, else their company. */
export function personName(p: Pick<PipeQueuePerson, "firstName" | "lastName" | "name" | "orgName">): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || p.orgName || "Unknown";
}
