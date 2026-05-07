/**
 * Turso migration deploy script (issue #62).
 *
 * Prisma's `migrate deploy` does not yet work over libSQL HTTP, so this
 * script is the project's first-class migration deploy path:
 *
 *   1. Connect to whatever `TURSO_DATABASE_URL` resolves to in `.env`.
 *   2. Ensure a `_prisma_migrations` tracking table exists. Schema matches
 *      Prisma's so future Prisma tooling can read it.
 *   3. For every directory under `server/prisma/migrations/`, in lexicographic
 *      order, apply `migration.sql` if it hasn't been recorded yet.
 *   4. Record success in `_prisma_migrations` with a SHA-256 checksum of the
 *      migration file (matches Prisma's checksum algorithm so a future swap
 *      to native `prisma migrate deploy` doesn't double-apply migrations).
 *
 * WARNING: This writes to whatever `TURSO_DATABASE_URL` is in your `.env`.
 *          Make sure you're pointing at the right database before running.
 *
 * Usage (from /server):
 *   npm run db:migrate:deploy           # apply pending migrations
 *   npm run db:migrate:deploy -- --dry  # preview pending migrations only
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@libsql/client";

loadEnv({ path: resolve(__dirname, "..", "..", ".env") });

const MIGRATIONS_DIR = resolve(__dirname, "..", "prisma", "migrations");
const dryRun = process.argv.includes("--dry");

interface Migration {
  name: string;
  sql: string;
  checksum: string;
}

function listMigrations(): Migration[] {
  let entries: string[];
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const migrations: Migration[] = [];
  for (const name of entries.sort()) {
    const full = join(MIGRATIONS_DIR, name);
    if (!statSync(full).isDirectory()) continue;
    const sqlPath = join(full, "migration.sql");
    let sql: string;
    try {
      sql = readFileSync(sqlPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
    migrations.push({
      name,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  return migrations;
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error("Missing TURSO_DATABASE_URL in .env");
    process.exit(1);
  }

  const client = createClient({ url, authToken: authToken || undefined });

  // Mirrors Prisma's internal _prisma_migrations schema so the table is
  // forward-compatible with `prisma migrate deploy` if/when it gains libSQL
  // support.
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
    );
  `);

  const applied = await client.execute(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
  );
  const appliedNames = new Set(applied.rows.map((r) => String(r.migration_name)));

  const migrations = listMigrations();
  const pending = migrations.filter((m) => !appliedNames.has(m.name));

  console.log(
    `Turso target: ${url.replace(/(authToken=)[^&]+/, "$1***")}`
  );
  console.log(
    `Migrations on disk: ${migrations.length}, applied: ${appliedNames.size}, pending: ${pending.length}`
  );

  if (pending.length === 0) {
    console.log("Database is up to date.");
    client.close();
    return;
  }

  for (const m of pending) {
    console.log(`  - ${m.name}`);
  }

  if (dryRun) {
    console.log("\nDry run: no changes applied.");
    client.close();
    return;
  }

  for (const m of pending) {
    const id = `${Date.now()}_${m.name}`;
    process.stdout.write(`Applying ${m.name}... `);
    try {
      // executeMultiple handles a SQL file containing several `;`-terminated
      // statements as a single batch.
      await client.executeMultiple(m.sql);
      await client.execute({
        sql: `INSERT INTO "_prisma_migrations"
              (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
              VALUES (?, ?, ?, current_timestamp, current_timestamp, 1)`,
        args: [id, m.checksum, m.name],
      });
      console.log("ok");
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      client.close();
      process.exit(1);
    }
  }

  console.log(`\nApplied ${pending.length} migration(s).`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
