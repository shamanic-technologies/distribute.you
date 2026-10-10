import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The Copilot maps any request onto the platform through the chat-service skill tree
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
    for (const t of ["list_sales_paths", "get_trigger_events", "list_sourcing_origins", "get_campaign", "list_connected_accounts"]) {
      expect(tools).toContain(t);
    }
  });

  it("declares channels, legs, trigger types and sales paths live", () => {
    for (const t of ["declare_channel", "declare_leg", "declare_trigger_type", "declare_sales_path", "list_trigger_types"]) expect(tools).toContain(t);
  });

  it("switches work on only through the two-step gate", () => {
    expect(tools).toContain("propose_switch_on");
    expect(tools).toContain("confirm_switch_on");
    for (const t of ["launch_campaign", "set_brand_pause", "set_daily_budget"]) expect(tools).not.toContain(t);
  });

  it("walks the agent catalogue on small pages, never the one huge catalogue read (owner 2026-10-10)", () => {
    for (const t of ["find_steps", "find_sales_paths", "find_channels", "find_pipes", "find_sales_funnels", "find_workflows", "create_step", "create_pipe", "create_sales_path", "create_sales_funnel"]) {
      expect(tools).toContain(t);
    }
    expect(tools).not.toContain("get_channel_catalogue");
  });

  it("runs a sales funnel as one campaign with caps, started only through the gate", () => {
    for (const t of ["list_funnel_campaigns", "get_funnel_caps", "set_funnel_caps", "create_funnel_campaign", "stop_funnel_campaign"]) expect(tools).toContain(t);
  });

  it("explores the infra by depth and files every kind of request", () => {
    for (const t of ["discover_services", "discover_service_endpoints", "discover_endpoint", "test_endpoint", "request_skill_upgrade", "contact_human"]) {
      expect(tools).toContain(t);
    }
  });

  it("never writes the offer's old ticked list: a campaign IS a funnel campaign (owner 2026-10-10)", () => {
    for (const t of ["set_selected_sales_paths", "get_selected_sales_paths"]) expect(tools).not.toContain(t);
    expect(tools).toContain("create_funnel_campaign");
  });

  it("never reads or writes the offer's old legs and accepted channels: brand-service retires them (2026-10-10)", () => {
    for (const t of ["get_offer_legs", "get_offer_channels", "set_offer_channels"]) expect(tools).not.toContain(t);
  });

  it("lists each tool once", () => {
    expect(new Set(tools).size).toBe(tools.length);
  });
});
