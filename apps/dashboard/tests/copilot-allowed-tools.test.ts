import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The staff Copilot maps any request onto the platform through the chat-service skill tree
// (owner 2026-10-09): read_skill, one read per entity, the two-step switch-on gate and the
// staff escalation. Nothing that creates AND starts work in one call.
const src = fs.readFileSync(path.resolve(__dirname, "../src/instrumentation.ts"), "utf-8");
const block = src.slice(src.indexOf("const COPILOT_ALLOWED_TOOLS = ["), src.indexOf("const PLATFORM_CHAT_CONFIGS"));
const tools = [...block.matchAll(/^\s+"([a-z_]+)",$/gm)].map((m) => m[1]);

describe("Copilot allowed tools", () => {
  it("reads the skill tree and escalates what needs code", () => {
    for (const t of ["read_skill", "request_staff", "list_staff_requests"]) expect(tools).toContain(t);
  });

  it("has one read per platform entity", () => {
    for (const t of ["get_channel_catalogue", "get_offer_legs", "list_sales_paths", "get_trigger_events", "list_sourcing_origins", "get_campaign", "list_connected_accounts"]) {
      expect(tools).toContain(t);
    }
  });

  it("switches work on only through the two-step gate", () => {
    expect(tools).toContain("propose_switch_on");
    expect(tools).toContain("confirm_switch_on");
    for (const t of ["launch_campaign", "set_brand_pause", "set_daily_budget"]) expect(tools).not.toContain(t);
  });

  it("lists each tool once", () => {
    expect(new Set(tools).size).toBe(tools.length);
  });
});
