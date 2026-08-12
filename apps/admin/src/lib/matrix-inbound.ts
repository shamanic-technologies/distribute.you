/**
 * The display model for a brand's inbound direct messages (crm-service's Matrix
 * source: WhatsApp / Telegram / Discord bridged into a homeserver).
 *
 * Alias-free apart from two type-only imports, so it carries REAL unit tests
 * rather than source-substring guards. Keep it that way: a runtime `@/…` import
 * turns those tests into resolution failures.
 *
 * Two rules the whole module exists to hold:
 *
 *  - A state states what HAPPENED, never what was attempted. A connection row
 *    exists as soon as somebody registered the bridge; that is not the same as
 *    the bridge having logged in and synced, so `synced` decides the word, not
 *    the mere presence of the row.
 *  - An absence is stated as an absence. A channel with no connection reads
 *    "Not connected"; a value the model had no basis for reads "Not stated".
 *    Neither ever collapses into a zero or an invented status.
 */

import type { MatrixConnection, MatrixLead } from "./api";

/** The three channels crm-service bridges, in the order they are shown. */
export const INBOUND_CHANNELS = ["whatsapp", "telegram", "discord"] as const;
export type InboundChannel = (typeof INBOUND_CHANNELS)[number];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
};

/** A channel crm-service adds later renders under its own name, not "Unknown". */
export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

/**
 * What a connection is actually doing right now.
 *
 * `notConnected` is the state this page is FIRST seen in: no bridge has been
 * logged in yet, so every channel is absent from the connections list.
 */
export type ConnectionStateKey =
  | "notConnected"
  | "error"
  | "paused"
  | "neverSynced"
  | "syncing";

export interface ConnectionState {
  key: ConnectionStateKey;
  label: string;
  /** Sentence stating what that means. Never a promise about what will happen. */
  detail: string;
  /** Tailwind tint. Every value is in the `html.dark` remapped closed set. */
  tone: "gray" | "red" | "yellow" | "green";
}

export function connectionState(connection: MatrixConnection | undefined): ConnectionState {
  if (!connection) {
    return {
      key: "notConnected",
      label: "Not connected",
      detail: "No bridge has been registered for this channel.",
      tone: "gray",
    };
  }
  if (connection.status === "error") {
    return {
      key: "error",
      label: "Error",
      // The reason belongs to the connection, so it is read off the connection.
      detail: connection.lastError ?? "The bridge reported an error with no detail.",
      tone: "red",
    };
  }
  if (connection.status === "paused") {
    return {
      key: "paused",
      label: "Paused",
      detail: "Sync passes skip this channel until it is resumed.",
      tone: "yellow",
    };
  }
  // Registered is not synced. A connection with no cursor has never completed a
  // pass, so saying "syncing" here would state something that has not happened.
  if (!connection.synced) {
    return {
      key: "neverSynced",
      label: "Never synced",
      detail: "Registered, but no sync pass has completed yet.",
      tone: "yellow",
    };
  }
  return {
    key: "syncing",
    label: "Syncing",
    detail: "The bridge is logged in and messages are arriving.",
    tone: "green",
  };
}

export interface ChannelRow {
  channel: string;
  label: string;
  connection: MatrixConnection | undefined;
  state: ConnectionState;
}

/**
 * One row per channel: the three known ones always, plus any other channel the
 * wire carries a connection for. Every channel is listed even when it has no
 * connection, because "this channel is not connected" is the answer the reader
 * came for.
 */
export function channelRows(connections: MatrixConnection[]): ChannelRow[] {
  const byChannel = new Map<string, MatrixConnection>();
  for (const c of connections) byChannel.set(c.channel, c);

  const extra = connections
    .map((c) => c.channel)
    .filter((c) => !(INBOUND_CHANNELS as readonly string[]).includes(c))
    .filter((c, i, all) => all.indexOf(c) === i)
    .sort();

  return [...INBOUND_CHANNELS, ...extra].map((channel) => {
    const connection = byChannel.get(channel);
    return {
      channel,
      label: channelLabel(channel),
      connection,
      state: connectionState(connection),
    };
  });
}

/** True when not one channel has ever completed a sync pass. */
export function noChannelSyncing(connections: MatrixConnection[]): boolean {
  return !connections.some((c) => c.synced && c.status === "active");
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  qualifying: "Qualifying",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
  unresponsive: "Unresponsive",
};

/** A status crm-service adds later renders verbatim rather than as a fallback. */
export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? status;
}

export function leadStatusTone(status: string): "gray" | "blue" | "yellow" | "green" | "red" {
  switch (status) {
    case "won":
      return "green";
    case "lost":
      return "red";
    case "negotiating":
      return "yellow";
    case "qualifying":
      return "blue";
    case "unresponsive":
      return "gray";
    case "new":
      return "blue";
    default:
      return "gray";
  }
}

/**
 * crm-service's prompt asks for 0 when the thread gives no basis for a value, so
 * 0 is the model saying "I could not tell", not "this deal is worth nothing".
 * Printing "$0" would state the second. A negative value is equally unstatable.
 */
export function estimatedValueLabel(usd: number): string | null {
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

/** Who wrote in: their name when the bridge gave us one, else their handle. */
export function leadContactLabel(lead: MatrixLead): string {
  const name = (lead.contactName ?? "").trim();
  if (name) return name;
  const handle = (lead.channelHandle ?? "").trim();
  if (handle) return handle;
  const phone = (lead.phoneE164 ?? "").trim();
  return phone || "Unnamed contact";
}

/**
 * The count in the page heading. It is the number of conversations the reading
 * has COVERED, not the number of conversations that exist: crm-service joins a
 * lead to its conversation, so a thread the model has not read yet is absent
 * from this list entirely rather than present with an empty status.
 */
export function conversationsReadLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "conversation" : "conversations"} read`;
}
