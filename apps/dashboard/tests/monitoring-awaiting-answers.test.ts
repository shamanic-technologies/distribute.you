import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AwaitingAnswersSchema, messageKindName, waitedFor } from "../src/lib/monitoring/awaiting-answers";

/**
 * Monitoring > Triggers > Waiting on us (REPLY-NO-BALANCE-1118): lead-service serves the people who wrote to a brand and
 * wait on our answer for more than an hour (`GET /internal/ops/awaiting-answers`), api-service passes it through
 * (`/v1/leads/ops/awaiting-answers`), the page draws it.
 */
const served = {
  generatedAt: "2026-11-18T12:00:00.000Z",
  days: 30,
  status: "red",
  redAfterMinutes: 60,
  lastSweepAt: "2026-11-18T11:55:00.000Z",
  sweepStale: false,
  lastSweepFailedBrands: 0,
  waiting: [
    {
      leadId: "870b8e2f-a5ec-41a3-b4bf-36716ae76c95", email: "drcampbell@arcticchiropractic.com", name: "Walter Campbell",
      waitingSince: "2026-11-11T02:09:28.000Z", lastMessageAt: "2026-11-11T02:09:28.000Z", lastMessageKind: "question",
      orgId: "91e76989-71ba-420d-ba73-bb3961430aa7", brandId: "75d7e3e8-6926-4f85-a557-976895400666",
    },
  ],
  byDay: [{ day: "2026-11-18", waitingOverHour: 1, maxWaitingOverHour: 3 }],
};

describe("awaiting answers monitoring", () => {
  it("parses the served payload", () => {
    const d = AwaitingAnswersSchema.parse(served);
    expect(d.status).toBe("red");
    expect(d.waiting[0].email).toBe("drcampbell@arcticchiropractic.com");
  });
  it("says a wait in hours, then days", () => {
    expect(waitedFor("2026-11-18T09:00:00Z", "2026-11-18T12:00:00Z")).toBe("3 h");
    expect(waitedFor("2026-11-11T02:09:28Z", "2026-11-18T12:00:00Z")).toBe("7 days");
    expect(messageKindName("question")).toBe("Asked a question");
  });
  it("is wired: staff path, sensitive root, page and hub tile", () => {
    const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");
    expect(src("lib/api.ts")).toContain('awaitingAnswers: "/leads/ops/awaiting-answers"');
    expect(src("lib/persist-cache.ts")).toContain('"staffAwaitingAnswers"');
    const page = src("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "triggers/awaiting" && <AwaitingAnswersPage />');
    expect(page).toContain('<AwaitingAnswersTile href={href("triggers/awaiting")} />');
  });
});
