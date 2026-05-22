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
 *
 * Caveat — the Neon HTTP driver wraps every `sql.query(...)` call in a
 * prepared statement, which Postgres restricts to ONE command per
 * statement. We therefore split each .sql file into individual statements
 * (terminated by `;`) and execute them one at a time. The splitter strips
 * line comments (`--`) and ignores empty fragments. Migrations that need
 * to span multiple commands inside a single transaction will require a
 * different driver (e.g. `pg.Client`); none of the current migrations do.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function splitSqlStatements(body) {
  return body
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n")
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

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
    const statements = splitSqlStatements(body);
    console.log(`[landing/migrations] Applying ${file} (${statements.length} statement(s))…`);
    for (const stmt of statements) {
      await sql.query(stmt);
    }
    console.log(`[landing/migrations] OK ${file}`);
  }

  console.log(`[landing/migrations] Done — ${files.length} migration(s) applied.`);
}

main().catch((err) => {
  console.error("[landing/migrations] Failed:", err);
  process.exit(1);
});
