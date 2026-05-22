#!/usr/bin/env node

/**
 * Runs every .sql file in apps/landing/migrations/ against DATABASE_URL in
 * lexicographic order. Every migration in this folder is idempotent (uses
 * IF NOT EXISTS guards) so re-running them on every Vercel build is safe.
 *
 * Skipped silently when DATABASE_URL is not configured — this is the path
 * that runs on local installs and on CI runners without a Neon binding.
 * The Vercel build for `distribute-landing` has DATABASE_URL set, so the
 * migrations run there.
 *
 * Invocation: `pnpm --filter @distribute/landing prebuild` (chained from
 * Vercel `next build` via package.json prebuild script).
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[landing/migrations] DATABASE_URL not set — skipping migrations.");
    return;
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[landing/migrations] No .sql files in migrations/ — nothing to do.");
    return;
  }

  const sql = neon(url);

  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const body = readFileSync(path, "utf8");
    console.log(`[landing/migrations] Applying ${file}…`);
    // neon's http driver executes one statement per call when invoked as a
    // function. Use the `query` method to send a multi-statement SQL blob.
    await sql.query(body);
    console.log(`[landing/migrations] OK ${file}`);
  }

  console.log(`[landing/migrations] Done — ${files.length} migration(s) applied.`);
}

main().catch((err) => {
  console.error("[landing/migrations] Failed:", err);
  process.exit(1);
});
