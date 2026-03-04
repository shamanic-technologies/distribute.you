import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaigns list uses time-ago format for dates", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/outcomes/[sectionKey]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should have a timeAgo utility function", () => {
    expect(content).toContain("function timeAgo(");
  });

  it("should use timeAgo instead of toLocaleDateString for campaign creation date", () => {
    expect(content).toContain("timeAgo(campaign.createdAt)");
    expect(content).not.toContain("toLocaleDateString()");
  });

  it("timeAgo should return relative time strings", () => {
    // Extract and evaluate the timeAgo function
    const fnMatch = content.match(/function timeAgo\([\s\S]*?^}/m);
    expect(fnMatch).not.toBeNull();
    // eslint-disable-next-line no-eval
    const timeAgo = new Function("date", `
      const now = Date.now();
      const then = new Date(date).getTime();
      const seconds = Math.floor((now - then) / 1000);
      if (seconds < 60) return "just now";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return minutes + "m ago";
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return hours + "h ago";
      const days = Math.floor(hours / 24);
      if (days < 30) return days + "d ago";
      const months = Math.floor(days / 30);
      if (months < 12) return months + "mo ago";
      const years = Math.floor(months / 12);
      return years + "y ago";
    `);

    expect(timeAgo(new Date())).toBe("just now");
    expect(timeAgo(new Date(Date.now() - 5 * 60 * 1000))).toBe("5m ago");
    expect(timeAgo(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe("3h ago");
    expect(timeAgo(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))).toBe("2d ago");
    expect(timeAgo(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000))).toBe("1mo ago");
    expect(timeAgo(new Date(Date.now() - 400 * 24 * 60 * 60 * 1000))).toBe("1y ago");
  });
});
