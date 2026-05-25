import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchPath = path.resolve(
  __dirname,
  "../../src/lib/performance/fetch-leaderboard.ts"
);
const content = fs.readFileSync(fetchPath, "utf-8");

describe("Leaderboard fetch reads recipient-based stat keys (matches features-service /v1/public/features/ranked)", () => {
  it('reads "recipientsSent"', () => {
    expect(content).toContain('"recipientsSent"');
  });

  it('reads "recipientsOpened"', () => {
    expect(content).toContain('"recipientsOpened"');
  });

  it('reads "recipientsClicked"', () => {
    expect(content).toContain('"recipientsClicked"');
  });

  it('reads "recipientsRepliesPositive"', () => {
    expect(content).toContain('"recipientsRepliesPositive"');
  });

  it('reply count uses positive-only (does NOT sum Negative + Neutral)', () => {
    expect(content).not.toContain('"recipientsRepliesNegative"');
    expect(content).not.toContain('"recipientsRepliesNeutral"');
  });

  it('does not read deprecated "emailsSent" stat key', () => {
    expect(content).not.toMatch(/num\(\s*r\.stats\s*,\s*"emailsSent"\s*\)/);
    expect(content).not.toMatch(/stats\["emailsSent"\]/);
  });

  it('does not read deprecated "emailsOpened" stat key', () => {
    expect(content).not.toMatch(/num\(\s*r\.stats\s*,\s*"emailsOpened"\s*\)/);
  });

  it('does not read deprecated "emailsClicked" stat key', () => {
    expect(content).not.toMatch(/num\(\s*r\.stats\s*,\s*"emailsClicked"\s*\)/);
  });

  it('does not read deprecated "repliesPositive" stat key', () => {
    expect(content).not.toMatch(/num\(\s*r\.stats\s*,\s*"repliesPositive"\s*\)/);
  });

  it('does not read deprecated "repliesNegative" stat key', () => {
    expect(content).not.toMatch(/num\(\s*r\.stats\s*,\s*"repliesNegative"\s*\)/);
  });

  it('does not read deprecated "repliesNeutral" stat key', () => {
    expect(content).not.toMatch(/num\(\s*r\.stats\s*,\s*"repliesNeutral"\s*\)/);
  });
});
