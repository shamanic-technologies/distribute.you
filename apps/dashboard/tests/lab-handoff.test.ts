import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DISTRY_WHATSAPP, distryWhatsAppHref, labAiPrompt } from "../src/lib/v2/lab-handoff";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("lab Distry hand-off (ONBOARDING-CHANNEL-HANDOFF-1125)", () => {
  it("opens WhatsApp on Distry's line, the support button's number, message typed", () => {
    expect(read("src/components/support/support-button.tsx")).toContain(`"${DISTRY_WHATSAPP}"`);
    expect(distryWhatsAppHref("Hi Distry!")).toBe(`https://wa.me/${DISTRY_WHATSAPP}?text=Hi%20Distry!`);
  });

  it("hands the founder's AI one line: our MCP server and their site, no key, no code", () => {
    const line = labAiPrompt("https://acme.com/", "https://mcp.distribute.you/mcp");
    expect(line).toContain("https://mcp.distribute.you/mcp");
    expect(line).toContain("acme.com");
    expect(line).not.toMatch(/key=|code/i);
  });

  it("creates the lab's campaign waiting, never started then stopped", () => {
    const api = read("src/lib/api.ts");
    const start = api.slice(api.indexOf("export async function startSalesFunnelCampaign("), api.indexOf("export async function getCampaignBriefPrefill("));
    expect(start).toContain('status: input.held ? "stopped" : "ongoing"');
    expect(read("src/components/v2/get-started/launch.ts")).toContain("launchCampaign(input.brandId, offerId, input.plan, progress, input.held === true)");
  });

  it("is worn only under the Distry skin: the page passes it, the walk and the wall read it", () => {
    expect(read("src/app/(authed)/get-started/page.tsx")).toContain("labDistry={skin}");
    const walk = read("src/components/v2/get-started/get-started.tsx");
    expect(walk).toContain("<LabDistryContext.Provider value={props.labDistry === true}>");
    expect(walk).toContain("if (lab)\n      return <LabSetupChoice");
    const wall = read("src/components/v2/get-started/account-card-wall.tsx");
    // After payment the lab shows the channel screen, never the dashboard.
    const launched = wall.indexOf('pingOwner({ event: "launched"');
    const handoff = wall.indexOf("setHandoff(campaignId)", launched);
    // chat-service learns which campaign waits BEFORE the screen hands over (Distry starts it on the first message).
    const told = wall.indexOf("await postCopilotHandoff({ campaignId })", launched);
    expect(told).toBeGreaterThan(launched);
    expect(handoff).toBeGreaterThan(told);
    expect(wall).toContain("{ brandId, website, offer, targetAudience, plan, answered, held: lab }");
    const dashboard = wall.indexOf('window.location.assign(v2Href(orgId, brandId, "today"))', launched);
    expect(launched).toBeGreaterThan(-1);
    expect(handoff).toBeGreaterThan(launched);
    expect(dashboard).toBeGreaterThan(handoff);
    expect(wall).toContain("<ChannelHandoff website={website} campaignId={handoff} />");
  });
});
