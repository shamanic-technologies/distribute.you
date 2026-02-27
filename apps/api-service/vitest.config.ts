import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      // Mock workspace packages that may not be built in CI
      "@mcpfactory/runs-client": path.resolve(__dirname, "tests/__mocks__/runs-client.ts"),
      "@mcpfactory/content": path.resolve(__dirname, "tests/__mocks__/content.ts"),
    },
  },
});
