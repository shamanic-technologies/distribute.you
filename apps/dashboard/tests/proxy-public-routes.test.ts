import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const proxyPath = path.resolve(__dirname, "../src/proxy.ts");

describe("dashboard proxy public routes", () => {
  it("keeps Vercel cron routes public so cron auth reaches the handler", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");

    expect(content).toContain('"/api/cron(.*)"');
  });
});
