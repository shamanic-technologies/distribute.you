import { afterEach, describe, expect, it } from "vitest";
import { verifyOutcomeDigestCronRequest } from "../src/lib/outcome-digest";

describe("outcome digest cron route", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("fails loud when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;

    expect(() => verifyOutcomeDigestCronRequest(
      new Request("https://dashboard.example.test/api/cron/outcome-digest"),
    )).toThrow("CRON_SECRET is required");
  });

  it("rejects requests without the configured cron bearer", () => {
    process.env.CRON_SECRET = "secret";

    expect(verifyOutcomeDigestCronRequest(
      new Request("https://dashboard.example.test/api/cron/outcome-digest"),
    )).toBe(false);
  });

  it("accepts the configured cron bearer", () => {
    process.env.CRON_SECRET = "secret";

    expect(verifyOutcomeDigestCronRequest(new Request("https://dashboard.example.test/api/cron/outcome-digest", {
      headers: { authorization: "Bearer secret" },
    }))).toBe(true);
  });
});
