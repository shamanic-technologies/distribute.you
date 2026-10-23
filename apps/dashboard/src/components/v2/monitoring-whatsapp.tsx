"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { useClientClock } from "@/lib/use-client-clock";
import { timeAgo } from "@/lib/friendly-datetime";
import { getStaffWhatsappLines, runStaffWhatsappLineCheck } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { Dash, Failed, Loading, OK, RED, TD, TH, Table, shortDay } from "@/components/v2/monitoring-sending";
import {
  dayStrip,
  linesDown,
  linkedLines,
  stateWord,
  type StripSlot,
  type WhatsappLine,
  type WhatsappLines,
} from "@/lib/monitoring/whatsapp-lines";

/**
 * Monitoring > WhatsApp > Lines (staff only, WA-LINE-MONITOR-1023). distribute.you's own line sat
 * logged out from 2026-10-19 to 10-22 and blocked every visitor greeting for 3 days unseen: crm-service
 * now watches every linked line every 2 min and stores a daily series. Red on the hub IS the alert
 * (no email). This file draws the served order and the served verdicts; it computes no figure.
 */

export const WHATSAPP_DAYS = 30;
const AMBER = "var(--data-amber)";
const MUTED = "var(--fg-4)";

export function useWhatsappLines() {
  return useAuthQuery(["staffWhatsappLines", WHATSAPP_DAYS], () => getStaffWhatsappLines(WHATSAPP_DAYS), { ...pollOptions, retry: false });
}

/** A line's colour now: the served `down` first (red), then its served state. */
function lineColor(line: WhatsappLine): string {
  if (line.current.down) return RED;
  if (line.current.state === "connected") return OK;
  if (line.current.state === "reconnecting") return AMBER;
  return MUTED;
}

const SLOT_COLOR: Record<"ok" | "down" | "unknown", string> = { ok: OK, down: RED, unknown: MUTED };

const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

function slotTitle(s: StripSlot): string {
  const d = s.served;
  if (!d) return `${shortDay(s.day)}: no history`;
  const parts = [`${shortDay(s.day)}: ${d.status === "ok" ? "OK" : d.status === "down" ? "Down" : "Unknown"}`];
  if (d.downMinutes) parts.push(`down ${minutes(d.downMinutes)}`);
  if (d.connectedMinutes) parts.push(`connected ${minutes(d.connectedMinutes)}`);
  if (d.reconnectingMinutes) parts.push(`reconnecting ${minutes(d.reconnectingMinutes)}`);
  if (d.unknownMinutes) parts.push(`not observed ${minutes(d.unknownMinutes)}`);
  if (d.recoveredOnItsOwn) parts.push(`${d.recoveredOnItsOwn} reconnect${d.recoveredOnItsOwn === 1 ? "" : "s"} healed on their own`);
  if (d.lastReason) parts.push(d.lastReason);
  return parts.join("\n");
}

/** One cell per day of the window, oldest left: green OK, red down, grey unknown, a flat track before history. */
function DayStrip({ slots }: { slots: StripSlot[] }) {
  return (
    <div className="flex h-5 items-end gap-[2px]" role="img" aria-label={`${slots.filter((s) => s.served?.status === "down").length} days down`}>
      {slots.map((s) => (
        <span
          key={s.day}
          title={slotTitle(s)}
          className="w-[5px] rounded-[1px]"
          style={s.served ? { height: 20, background: SLOT_COLOR[s.served.status] } : { height: 3, background: "var(--data-track)" }}
        />
      ))}
    </div>
  );
}

function NowCell({ line, now }: { line: WhatsappLine; now: Date | null }) {
  const c = line.current;
  return (
    <div className="min-w-0">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
        <span className={`h-1.5 w-1.5 rounded-full ${c.state === "connected" && !c.down ? "k-dot-pulse" : ""}`} style={{ background: lineColor(line), color: lineColor(line) }} aria-hidden="true" />
        <span style={{ color: c.down ? RED : undefined }}>{stateWord(c.state)}</span>
        {c.since && <span className="k-fg3 text-[12px]">{now ? timeAgo(c.since, now).toLowerCase() : `since ${shortDay(c.since)}`}</span>}
      </span>
      {c.reason && <p className="k-fg3 mt-0.5 line-clamp-2 text-[12px]">{c.reason}</p>}
    </div>
  );
}

function LinesTable({ data }: { data: WhatsappLines }) {
  const now = useClientClock();
  return (
    <Table
      head={
        <>
          <th className={TH}>Line</th>
          <th className={TH}>Now</th>
          <th className={TH}>Last {WHATSAPP_DAYS} days</th>
          <th className={TH}>Checked</th>
        </>
      }
    >
      {data.lines.map((line) => (
        <tr key={`${line.brandId}|${line.phone}`} className="k-row align-top">
          <td className={TD}>
            <span className="whitespace-nowrap">
              <span className="k-mono text-[13px]">{line.phone}</span>
              {!line.linked && <span className="k-chip ml-2">Unlinked</span>}
            </span>
            <p className="k-fg3 mt-0.5 text-[12px]" title={line.namesUnresolvedReason ?? undefined}>
              {line.brandName ?? <Dash />}
              {line.orgName && line.orgName.toLowerCase() !== line.brandName?.toLowerCase() ? ` · ${line.orgName}` : ""}
            </p>
          </td>
          <td className={`${TD} max-w-[420px]`}>
            <NowCell line={line} now={now} />
          </td>
          <td className={TD}>
            <DayStrip slots={dayStrip(data.from, data.to, line.days)} />
          </td>
          <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
            {line.current.checkedAt ? (now ? timeAgo(line.current.checkedAt, now) : shortDay(line.current.checkedAt)) : <Dash />}
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function WhatsappLinesPage() {
  const q = useWhatsappLines();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const data = q.data;

  const checkNow = async () => {
    setChecking(true);
    setRefused(null);
    try {
      await runStaffWhatsappLineCheck();
    } catch (err) {
      console.error("[dashboard] runStaffWhatsappLineCheck failed", { err });
      setRefused("The check did not run. Try again in a minute.");
      setChecking(false);
      return;
    }
    await queryClient.refetchQueries({ queryKey: ["staffWhatsappLines"] });
    setChecking(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="k-fg2 text-[13px]">Every linked WhatsApp line, checked every 2 minutes. A red line sends nothing: relink it from Integrations.</p>
          <button type="button" disabled={checking} onClick={checkNow} className="k-btn">
            {checking ? "Checking…" : "Check now"}
          </button>
        </div>
        {refused && (
          <p className="text-[12px]" style={{ color: RED }}>
            {refused}
          </p>
        )}
      </div>

      {q.isError && !data ? (
        <Failed what="the WhatsApp lines" />
      ) : !data ? (
        <Loading />
      ) : (
        <section>
          <SectionTitle
            count={linkedLines(data).length}
            right={
              <span className="inline-flex items-center gap-3">
                {(["ok", "down", "unknown"] as const).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: SLOT_COLOR[k] }} aria-hidden="true" />
                    {k === "ok" ? "OK" : k === "down" ? "Down" : "Unknown"}
                  </span>
                ))}
              </span>
            }
          >
            Linked lines
          </SectionTitle>
          {data.lines.length === 0 ? (
            <div className="k-card">
              <EmptyNote>No WhatsApp line is linked yet.</EmptyNote>
            </div>
          ) : (
            <LinesTable data={data} />
          )}
        </section>
      )}
    </div>
  );
}

/** The hub's one-second read: how many linked lines are down now, red when any is. */
export function WhatsappLinesTile({ href }: { href: string }) {
  const q = useWhatsappLines();
  const data = q.data;
  const down = data ? linesDown(data) : undefined;
  const linked = data ? linkedLines(data) : undefined;
  return (
    <StatTile label="WhatsApp lines down" note={data ? `of ${linked!.length} linked` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : down === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: down.length ? RED : undefined }}>{down.length}</span>
          )
        }
        sub={down === undefined ? undefined : down.length ? down.map((l) => l.phone).join(", ") : "none down now"}
      />
    </StatTile>
  );
}
