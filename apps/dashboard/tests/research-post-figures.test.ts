import { describe, expect, it } from "vitest";
import { costPerSignupText, hasPostFigures, postCountText, type ResearchPostFigures } from "../src/lib/research/research";

// THREADS-IDEAS-AB: a post-writing pipe's template and LLM rows carry `postFigures` (features-service);
// the Research list shows the post columns only when a row of the pipe carries them.
const figures: ResearchPostFigures = { posts: 14, views: 48210, engagements: 1932, visits: 212, signups: 6, spentUsd: 41.2, costPerSignupUsd: 6.87 };

describe("research post figures", () => {
  it("shows the post columns only on a pipe whose rows carry post figures", () => {
    expect(hasPostFigures([{ postFigures: figures }, { postFigures: null }])).toBe(true);
    // a cold-email pipe: null, or absent on an older build
    expect(hasPostFigures([{ postFigures: null }, {}])).toBe(false);
    expect(hasPostFigures([])).toBe(false);
  });

  it("prints served counts and $ per signup, Learning while no signup came", () => {
    expect(postCountText(48210)).toBe("48,210");
    expect(costPerSignupText(6.87)).toBe("$6.87");
    expect(costPerSignupText(22.4)).toBe("$22");
    expect(costPerSignupText(null)).toBe("Learning");
  });
});
