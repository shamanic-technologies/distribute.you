import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  INBOUND_CHANNELS,
  channelLabel,
  channelRows,
  connectionState,
  conversationsReadLabel,
  estimatedValueLabel,
  leadContactLabel,
  leadStatusLabel,
  leadStatusTone,
  noChannelSyncing,
} from "../src/lib/matrix-inbound";
import type { MatrixConnection, MatrixLead } from "../src/lib/api";

const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf-8");
const lib = readFileSync(join(__dirname, "../src/lib/matrix-inbound.ts"), "utf-8");
const page = readFileSync(
  join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/services/crm/inbound/page.tsx",
  ),
  "utf-8",
);
const sidebar = readFileSync(join(__dirname, "../src/components/context-sidebar.tsx"), "utf-8");

function conn(over: Partial<MatrixConnection> = {}): MatrixConnection {
  return {
    id: "c1",
    brandId: "b1",
    channel: "whatsapp",
    matrixUserId: "@owner:example.org",
    counterpartPrefix: "@whatsapp_",
    status: "active",
    synced: true,
    lastSyncedAt: "2026-08-12T09:00:00.000Z",
    lastError: null,
    lastRunId: "run-1",
    createdAt: "2026-08-01T09:00:00.000Z",
    ...over,
  };
}

function lead(over: Partial<MatrixLead> = {}): MatrixLead {
  return {
    id: "l1",
    brandId: "b1",
    status: "qualifying",
    nextStep: "Send the pricing sheet",
    estimatedValueUsd: 2500,
    summary: "Asked about the monthly plan",
    model: "some-model-id",
    computedAt: "2026-08-12T09:05:00.000Z",
    computedThroughEventId: "$evt",
    contactId: "ct1",
    contactName: "Ada Lovelace",
    channel: "whatsapp",
    channelHandle: "@whatsapp_123:example.org",
    phoneE164: "+15550001111",
    conversationId: "cv1",
    firstMessageAt: "2026-08-10T09:00:00.000Z",
    lastMessageAt: "2026-08-12T08:55:00.000Z",
    messageCount: 8,
    inboundCount: 5,
    outboundCount: 3,
    ...over,
  };
}

describe("a channel states what happened, not what was attempted", () => {
  it("reads a missing connection as not connected", () => {
    const state = connectionState(undefined);
    expect(state.key).toBe("notConnected");
    expect(state.label).toBe("Not connected");
  });

  it("does not call a registered but never synced connection live", () => {
    const state = connectionState(conn({ synced: false }));
    expect(state.key).toBe("neverSynced");
    expect(state.label).toBe("Never synced");
  });

  it("reads an active synced connection as syncing", () => {
    expect(connectionState(conn()).key).toBe("syncing");
  });

  it("reads a paused connection as paused even once it has synced", () => {
    expect(connectionState(conn({ status: "paused" })).key).toBe("paused");
  });

  it("carries the bridge's own reason on an error, and states its absence", () => {
    expect(connectionState(conn({ status: "error", lastError: "token expired" })).detail).toBe(
      "token expired",
    );
    expect(connectionState(conn({ status: "error", lastError: null })).detail).toContain(
      "no detail",
    );
  });
});

describe("the channel list", () => {
  it("lists all three channels even when nothing is connected", () => {
    const rows = channelRows([]);
    expect(rows.map((r) => r.channel)).toEqual([...INBOUND_CHANNELS]);
    expect(rows.every((r) => r.state.key === "notConnected")).toBe(true);
  });

  it("binds each connection to its own channel and leaves the rest absent", () => {
    const rows = channelRows([conn({ channel: "telegram" })]);
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r.state.key]));
    expect(byChannel).toEqual({
      whatsapp: "notConnected",
      telegram: "syncing",
      discord: "notConnected",
    });
  });

  it("shows a channel crm-service adds later rather than dropping it", () => {
    const rows = channelRows([conn({ channel: "signal" })]);
    expect(rows.map((r) => r.channel)).toEqual([...INBOUND_CHANNELS, "signal"]);
    expect(rows[rows.length - 1].label).toBe("signal");
  });

  it("names the known channels the way a person writes them", () => {
    expect(channelLabel("whatsapp")).toBe("WhatsApp");
    expect(channelLabel("telegram")).toBe("Telegram");
    expect(channelLabel("discord")).toBe("Discord");
  });

  it("knows when not one channel is syncing", () => {
    expect(noChannelSyncing([])).toBe(true);
    expect(noChannelSyncing([conn({ synced: false })])).toBe(true);
    expect(noChannelSyncing([conn({ status: "paused" })])).toBe(true);
    expect(noChannelSyncing([conn()])).toBe(false);
  });
});

describe("a value the model had no basis for is not a zero", () => {
  it("states an absence rather than printing $0", () => {
    expect(estimatedValueLabel(0)).toBeNull();
    expect(estimatedValueLabel(-5)).toBeNull();
    expect(estimatedValueLabel(Number.NaN)).toBeNull();
  });

  it("prints a real value with a thousands separator", () => {
    expect(estimatedValueLabel(2500)).toBe("$2,500");
    expect(estimatedValueLabel(12)).toBe("$12");
  });
});

describe("the lead reading", () => {
  it("labels every status crm-service declares", () => {
    expect(leadStatusLabel("new")).toBe("New");
    expect(leadStatusLabel("qualifying")).toBe("Qualifying");
    expect(leadStatusLabel("negotiating")).toBe("Negotiating");
    expect(leadStatusLabel("won")).toBe("Won");
    expect(leadStatusLabel("lost")).toBe("Lost");
    expect(leadStatusLabel("unresponsive")).toBe("Unresponsive");
  });

  it("renders a status added later verbatim instead of inventing one", () => {
    expect(leadStatusLabel("stalled")).toBe("stalled");
    expect(leadStatusTone("stalled")).toBe("gray");
  });

  it("names the person, falling back to the handle we actually hold", () => {
    expect(leadContactLabel(lead())).toBe("Ada Lovelace");
    expect(leadContactLabel(lead({ contactName: "  " }))).toBe("@whatsapp_123:example.org");
    expect(leadContactLabel(lead({ contactName: null, channelHandle: null }))).toBe(
      "+15550001111",
    );
    expect(
      leadContactLabel(lead({ contactName: null, channelHandle: null, phoneE164: null })),
    ).toBe("Unnamed contact");
  });

  it("counts conversations READ, and agrees with itself on the plural", () => {
    expect(conversationsReadLabel(0)).toBe("0 conversations read");
    expect(conversationsReadLabel(1)).toBe("1 conversation read");
    expect(conversationsReadLabel(1200)).toBe("1,200 conversations read");
  });
});

describe("the readers match the deployed gateway routes", () => {
  it("calls the two proxied paths byte-equal", () => {
    expect(api).toContain("`/orgs/matrix/leads?brandId=${encodeURIComponent(brandId)}`");
    expect(api).toContain("`/orgs/matrix/connections?brandId=${encodeURIComponent(brandId)}`");
  });

  it("fails loud on a shape mismatch instead of defaulting", () => {
    const start = api.indexOf("// ── CRM service (inbound Matrix DMs)");
    const end = api.indexOf("// human-service audiences, reached through the api-service gateway", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = api.slice(start, end);
    expect(block).not.toContain(".default(");
    expect(block).toContain("listMatrixLeads: invalid response shape");
    expect(block).toContain("listMatrixConnections: invalid response shape");
  });
});

describe("the page follows the app's read conventions", () => {
  it("polls on the one shared cadence, never a hardcoded interval", () => {
    expect(page).toContain('from "@/lib/query-options"');
    expect(page).not.toContain("refetchInterval:");
  });

  it("reveals on settle, so a failing read can never skeleton forever", () => {
    expect(page).toContain("const leadsSettled = !leadsPending || leadsError;");
    expect(page).toContain("const connectionsSettled = !connectionsPending || connectionsError;");
  });

  it("gates each card on its own read", () => {
    expect(page).toContain("{!leadsSettled ?");
    expect(page).toContain("{!connectionsSettled ?");
  });

  it("carries no em-dash in what a person reads", () => {
    expect(page).not.toContain("—");
    expect(lib).not.toContain("—");
  });
});

describe("the CRM sidebar reaches the second source", () => {
  it("lists Inbound DMs beside Leads and Sources", () => {
    expect(sidebar).toContain('id: "crm-inbound"');
    expect(sidebar).toContain('label: "Inbound DMs"');
    expect(sidebar).toContain("`${basePath}/inbound`");
  });

  it("shares the leads query key with the page, so the two cannot disagree", () => {
    expect(sidebar).toContain('["matrixLeads", brandId]');
    expect(page).toContain('["matrixLeads", brandId]');
  });
});
