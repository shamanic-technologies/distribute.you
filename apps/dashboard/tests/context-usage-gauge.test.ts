import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  formatUsageLabel,
  clampPercent,
} from "../src/components/chat/context-usage-gauge";

const SRC = path.resolve(__dirname, "..");

describe("context-usage-gauge formatters", () => {
  describe("formatUsageLabel", () => {
    it("formats inputTokens / maxTokens with thousands separators", () => {
      expect(formatUsageLabel(42100, 200000)).toBe("42,100 / 200,000");
    });

    it("handles zero usage", () => {
      expect(formatUsageLabel(0, 200000)).toBe("0 / 200,000");
    });
  });

  describe("clampPercent", () => {
    it("rounds and clamps into [0, 100]", () => {
      expect(clampPercent(21.6)).toBe(22);
      expect(clampPercent(-5)).toBe(0);
      expect(clampPercent(150)).toBe(100);
      expect(clampPercent(0)).toBe(0);
      expect(clampPercent(100)).toBe(100);
    });
  });
});

describe("context-usage-gauge component source", () => {
  const gaugePath = path.join(
    SRC,
    "src/components/chat/context-usage-gauge.tsx",
  );
  const src = fs.readFileSync(gaugePath, "utf-8");

  it("exports ContextUsageGauge component", () => {
    expect(src).toMatch(/export\s+function\s+ContextUsageGauge/);
  });

  it("returns null when usage is missing", () => {
    expect(src).toMatch(/if\s*\(\s*!usage\s*\)\s*return\s+null/);
  });

  it("renders inputTokens / maxTokens label", () => {
    expect(src).toContain("formatUsageLabel");
  });

  it("renders integer percent with % suffix", () => {
    expect(src).toMatch(/\$\{[^}]*\}%/);
  });

  it("uses width style driven by clamped percent", () => {
    expect(src).toContain("clampPercent");
    expect(src).toMatch(/width:\s*`\$\{/);
  });
});

describe("chat components wire ContextUsageGauge", () => {
  const components = [
    "src/components/workflows/workflow-chat.tsx",
    "src/components/press-kits/press-kit-chat.tsx",
    "src/components/campaigns/campaign-prefill-chat.tsx",
  ];

  for (const rel of components) {
    describe(rel, () => {
      const src = fs.readFileSync(path.join(SRC, rel), "utf-8");

      it("imports ContextUsageGauge", () => {
        expect(src).toContain("ContextUsageGauge");
        expect(src).toMatch(
          /from\s+["']@\/components\/chat\/context-usage-gauge["']/,
        );
      });

      it("listens for data-context-usage events", () => {
        expect(src).toContain("data-context-usage");
      });

      it("renders <ContextUsageGauge ", () => {
        expect(src).toMatch(/<ContextUsageGauge[\s/>]/);
      });
    });
  }
});

describe("chat proxy forwards context_usage", () => {
  const routePath = path.join(SRC, "src/app/api/v1/chat/route.ts");
  const src = fs.readFileSync(routePath, "utf-8");

  it("has a context_usage case in the event switch", () => {
    expect(src).toMatch(/case\s+["']context_usage["']/);
  });

  it("emits data-context-usage", () => {
    expect(src).toContain("data-context-usage");
  });

  it("preserves maxTokens fallback at 200000", () => {
    expect(src).toContain("200000");
  });
});
