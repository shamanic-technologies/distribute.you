import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { helpText } from "../../src/help.js";
import { ROUTES } from "../../src/routes.js";

const SRC = join(__dirname, "..", "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("copy", () => {
  it("uses no em-dash anywhere a person reads", () => {
    for (const file of sourceFiles(SRC)) {
      expect(`${file}:${readFileSync(file, "utf8").includes("—")}`).toBe(`${file}:false`);
    }
  });

  it("describes every named command in the help", () => {
    const text = helpText();
    for (const route of ROUTES) {
      const name = route.action === "" ? route.group : `${route.group} ${route.action}`;
      expect(text).toContain(name);
    }
  });

  it("states the exit codes an agent branches on", () => {
    expect(helpText()).toMatch(/3 auth/);
    expect(helpText()).toMatch(/6 network/);
  });

  it("claims no install path, because the package is not published yet", () => {
    expect(helpText()).not.toMatch(/npm install|npx |pnpm add/);
  });
});
