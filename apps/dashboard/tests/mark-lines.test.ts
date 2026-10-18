import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Owner rule 2026-10-11: a mark beside two lines is as tall as both lines, through ONE primitive. */
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("MarkLines: a mark beside two lines is as tall as the lines", () => {
  it("the primitive measures the two lines and sizes the mark, top and bottom aligned", () => {
    const ui = src("src/components/v2/ui.tsx");
    expect(ui).toContain("export function MarkLines(");
    expect(ui).toContain("new ResizeObserver(measure)");
    expect(ui).toContain("items-start");
  });

  it.each([
    ["src/components/v2/funnel-campaigns.tsx", "<FunnelFace name={campaign.salesFunnelName} size={px} />"],
    ["src/components/v2/integrations-conversations.tsx", "mark={(px) => <PersonMark name={name} emails={person.emails} size={px} />}"],
    ["src/components/v2/staff-catalogue-pages.tsx", "face={r.face} name={r.name} size={px} />}"],
    ["src/components/v2/staff-campaign-pages.tsx", "<CatalogueMark face={funnel?.face} name={c.salesFunnelName} size={px} />"],
    ["src/components/v2/offer-campaigns.tsx", "<PathAvatar name={campaign.name} size={px} />"],
    ["src/components/v2/today-page.tsx", "mark={(px) => <PipeFace name={name} size={px} />}"],
  ])("%s draws its two-line mark through MarkLines", (file, call) => {
    const s = src(file);
    expect(s).toContain("<MarkLines");
    expect(s).toContain(call);
  });
});
