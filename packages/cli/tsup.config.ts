import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  dts: true,
  clean: true,
  // The published file is executed directly by npm's bin shim.
  banner: { js: "#!/usr/bin/env node" },
});
