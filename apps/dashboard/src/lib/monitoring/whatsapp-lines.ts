import { z } from "zod";

/**
 * Monitoring > WhatsApp > Lines (staff only, WA-LINE-MONITOR-1023), alias-free so vitest reads it directly.
 *
 * crm-service's line watch (crm #190, WA-LINE-HEALTH-1023) through api-service's staff passthrough
 * (#1358): `GET /v1/crm/ops/whatsapp-lines?days=` serves every linked WhatsApp line fleet-wide, its
 * state now and a stored daily series; `POST /v1/crm/ops/whatsapp-lines/check` runs one watch pass.
 * Lines come linked first, red first; days oldest first, only days with history. The page renders
 * that order and the served `down` / `status` verdicts as they are: no sort, no uptime %, no
 * re-grading from the minutes. Red on the hub IS the alert (no email, owner 2026-10-22).
 */

export const WhatsappLineStateSchema = z.enum(["connected", "reconnecting", "logged_out", "bridge_unreachable", "unknown"]);
export type WhatsappLineState = z.infer<typeof WhatsappLineStateSchema>;

export const WhatsappLineDaySchema = z.object({
  day: z.string(),
  status: z.enum(["ok", "down", "unknown"]),
  connectedMinutes: z.number(),
  reconnectingMinutes: z.number(),
  downMinutes: z.number(),
  unknownMinutes: z.number(),
  recoveredOnItsOwn: z.number(),
  lastState: z.string().nullable(),
  lastReason: z.string().nullable(),
});
export type WhatsappLineDay = z.infer<typeof WhatsappLineDaySchema>;

export const WhatsappLineSchema = z.object({
  orgId: z.string(),
  brandId: z.string(),
  phone: z.string(),
  linkId: z.string().nullable(),
  linked: z.boolean(),
  // crm #194: the brand's and the org's names in plain words, null with the producer's reason.
  // `.nullish()` until the box serves crm v0.86.4 (required-and-nullable once live).
  brandName: z.string().nullish(),
  orgName: z.string().nullish(),
  namesUnresolvedReason: z.string().nullish(),
  current: z.object({
    state: WhatsappLineStateSchema,
    down: z.boolean(),
    since: z.string().nullable(),
    checkedAt: z.string().nullable(),
    bridgeState: z.string().nullable(),
    reason: z.string().nullable(),
  }),
  days: z.array(WhatsappLineDaySchema),
});
export type WhatsappLine = z.infer<typeof WhatsappLineSchema>;

export const WhatsappLinesSchema = z.object({
  generatedAt: z.string(),
  from: z.string(),
  to: z.string(),
  lines: z.array(WhatsappLineSchema),
});
export type WhatsappLines = z.infer<typeof WhatsappLinesSchema>;

/** The producer's own state, capitalised: "logged_out" -> "Logged out". A name, never a re-graded verdict. */
export function stateWord(state: WhatsappLineState): string {
  const w = state.replace(/_/g, " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** The lines the hub turns red on: linked AND served `down` now. */
export function linesDown(data: WhatsappLines): WhatsappLine[] {
  return data.lines.filter((l) => l.linked && l.current.down);
}

export function linkedLines(data: WhatsappLines): WhatsappLine[] {
  return data.lines.filter((l) => l.linked);
}

/** One slot of the day strip: a served day, or a day of the window the line has no history for. */
export type StripSlot = { day: string; served: WhatsappLineDay | null };

/**
 * The window's calendar, `from` to `to` (UTC, inclusive), each slot holding the served day when
 * there is one. Lays out what is served; computes no figure.
 */
export function dayStrip(from: string, to: string, days: WhatsappLineDay[]): StripSlot[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const out: StripSlot[] = [];
  const end = Date.parse(`${to}T00:00:00.000Z`);
  for (let t = Date.parse(`${from}T00:00:00.000Z`); t <= end; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, served: byDay.get(day) ?? null });
  }
  return out;
}
