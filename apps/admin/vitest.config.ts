import { defineConfig } from "vitest/config";
import * as path from "path";

/**
 * The only thing this config exists for is the `@` alias.
 *
 * Without it vitest cannot resolve `@/lib/...`, so any module carrying one is
 * import-only-in-Next and its tests have to fall back to reading the source as a
 * string. That is why so many guards here are source-substring assertions rather
 * than real calls. With the alias, a route handler that imports `@/lib/proxy-org`
 * can be driven for real — mock Clerk, spy `fetch`, assert what actually went out.
 *
 * Discovery and the `--exclude 'tests/e2e/**'` flag in the package script are
 * untouched: the Playwright specs still stay out of the vitest run.
 */
/**
 * isomorphic-dompurify pulls jsdom, whose undici needs Node >= 22.19 (zlib zstd). On an
 * older Node the sanitizer test dies at import with "reading 'bind'", which reads as a
 * broken sanitizer. Prod runs Node 22.23 (see /.nvmrc), so say what is wrong instead.
 */
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 19)) {
  throw new Error(
    `admin tests need Node >= 22.19 (prod runs the version in /.nvmrc), got ${process.versions.node}. Run \`nvm use\` at the repo root.`,
  );
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
