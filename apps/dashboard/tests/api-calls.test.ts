import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiCallDetailSchema, itemCallId, callStatusTone, formatBytes, prettyBody, queryValue } from "../src/lib/api-calls";
import { PersonTimelineItemSchema, channelLabel, sourceLabel } from "../src/lib/people-conversations";
import { personSourceMarks, sourceMark } from "../src/lib/conversation-sources";

// Captured from prod crm-service 2026-10-12: two thread items per call, and the call detail.
const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures", "unibox-api-calls.json"), "utf8"));

describe("API / MCP calls in the Unibox: marks", () => {
  it("names a call through the API as API and one through our MCP server as MCP, both our mark", () => {
    expect(sourceMark("api", "api")).toEqual({ key: "distribute", name: "API", domain: null, src: "/logo-distribute.svg" });
    expect(sourceMark("api", "mcp")).toEqual({ key: "distribute", name: "MCP", domain: null, src: "/logo-distribute.svg" });
  });

  it("labels the source and channels for a reader, never a raw lowercase word", () => {
    expect(sourceLabel("api")).toBe("API");
    expect(channelLabel("api")).toBe("API");
    expect(channelLabel("mcp")).toBe("MCP");
  });

  it("a person reached by API and MCP shows our mark once in the list", () => {
    expect(personSourceMarks([{ source: "api", channel: "api" }, { source: "api", channel: "mcp" }])).toHaveLength(1);
  });
});

describe("API / MCP calls in the Unibox: thread items", () => {
  it("parses the served items with their ref and reads the call id", () => {
    const items = fixture.items.map((x: unknown) => PersonTimelineItemSchema.parse(x));
    expect(items).toHaveLength(4);
    const mcp = items.find((i: { channel: string }) => i.channel === "mcp")!;
    expect(mcp.ref?.mcpTool).toBe("distribute_list_brands");
    expect(itemCallId(mcp)).toBe("a5d293f1-41be-490d-b928-ec0482453a7c");
    expect(sourceMark(mcp.source, mcp.channel).name).toBe("MCP");
    const api = items.find((i: { channel: string }) => i.channel === "api")!;
    expect(sourceMark(api.source, api.channel).name).toBe("API");
  });

  it("only an api item has a call id", () => {
    expect(itemCallId({ source: "gmail", ref: { callId: "x" } })).toBeNull();
    expect(itemCallId({ source: "api", ref: null })).toBeNull();
    expect(itemCallId({ source: "api", ref: { callId: "c1" } })).toBe("c1");
  });

  it("an item from before ref was served still parses", () => {
    const { ref: _ref, ...old } = fixture.items[0];
    expect(PersonTimelineItemSchema.safeParse(old).success).toBe(true);
  });
});

describe("API / MCP call detail reader", () => {
  it("safeParses both prod call shapes (MCP and API)", () => {
    for (const k of ["mcp", "api"]) {
      const r = ApiCallDetailSchema.safeParse(fixture.calls[k]);
      expect(r.success).toBe(true);
    }
    const mcp = ApiCallDetailSchema.parse(fixture.calls.mcp);
    expect(mcp.request.method).toBe("GET");
    expect(mcp.request.path).toBe("/v1/brands");
    expect(mcp.response.status).toBe(200);
  });

  it("refuses a body missing the response", () => {
    const { response: _r, ...rest } = fixture.calls.api;
    expect(ApiCallDetailSchema.safeParse(rest).success).toBe(false);
  });

  it("indents a JSON body and leaves a cut one verbatim", () => {
    expect(prettyBody('{"a":1}')).toEqual({ text: '{\n  "a": 1\n}', json: true });
    expect(prettyBody('{"a":[1,2')).toEqual({ text: '{"a":[1,2', json: false });
    expect(prettyBody(null)).toBeNull();
    expect(prettyBody("")).toBeNull();
  });

  it("formats statuses, sizes and query values", () => {
    expect(callStatusTone(200)).toBe("ok");
    expect(callStatusTone(400)).toBe("refused");
    expect(callStatusTone(502)).toBe("failed");
    expect(formatBytes(652)).toBe("652 B");
    expect(formatBytes(36227)).toBe("35.4 KB");
    expect(queryValue("x")).toBe("x");
    expect(queryValue(["a", "b"])).toBe('["a","b"]');
  });
});

describe("the thread opens the call on our answer", () => {
  it("Message wires the call detail on demand", () => {
    const src = readFileSync(join(__dirname, "..", "src", "components", "v2", "integrations-conversations.tsx"), "utf8");
    expect(src).toContain("itemCallId(item)");
    expect(src).toContain("<ApiCallDetailPanel brandId={brandId} callId={callId} />");
  });
});
