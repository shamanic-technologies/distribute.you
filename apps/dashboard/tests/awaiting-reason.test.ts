import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { awaitingReason, waitedFor } from "../src/lib/awaiting-reason";

const NOW = Date.parse("2026-10-11T15:00:00Z");

describe("awaitingReason: why a person needs your call, in one line", () => {
  it("words a question by how long it waited (Lukas, Oct 6)", () => {
    expect(awaitingReason("question", "2026-10-06T17:08:29Z", NOW)).toBe("Asked a question, unanswered for 4 days");
  });
  it("keeps an old interested reply and shows its age (dbobrow, Aug 14)", () => {
    expect(awaitingReason("interest", "2026-08-14T10:00:00Z", NOW)).toBe("Replied with interest, unanswered for 58 days");
  });
  it("words the other kinds plainly", () => {
    expect(awaitingReason("other", "2026-10-11T12:00:00Z", NOW)).toBe("Wrote back, unanswered for 3 hours");
  });
  it("singular and under-an-hour forms", () => {
    expect(waitedFor("2026-10-11T14:30:00Z", NOW)).toBe("under an hour");
    expect(waitedFor("2026-10-11T13:30:00Z", NOW)).toBe("1 hour");
    expect(waitedFor("2026-10-10T14:00:00Z", NOW)).toBe("1 day");
  });
});

describe("Needs your call reads lead-service's waiting-on-us set", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
  it("the hook counts and lists getAwaitingReply, never a bucket or a standing", () => {
    const data = read("src/components/v2/data.ts");
    const body = data.slice(data.indexOf("export function useNeedsYourCall"), data.indexOf("export function useInterestedReplies"));
    expect(body).toContain("getAwaitingReply(brandId)");
    expect(body).toContain("total: awaiting.total");
    expect(body).not.toContain("bucket:");
    expect(body).not.toContain("standing:");
  });
  it("Today cards say why, and carry no manual answered button (lead-service drops answered people itself)", () => {
    for (const f of ["today-page.tsx"]) {
      const src = read(`src/components/v2/${f}`);
      expect(src).toContain("awaitingReason(");
      expect(src).not.toContain("MarkAnswered");
    }
    expect(read("src/lib/api.ts")).not.toContain("answered-outside");
  });
  it("Needs your call never links to the interested standing", () => {
    expect(read("src/components/v2/today-page.tsx")).not.toMatch(/All \$\{formatCount\([a-zA-Z]+\)\} interested/);
  });
});
