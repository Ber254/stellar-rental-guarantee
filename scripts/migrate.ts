import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

type JournalEntry = { idx: number; when: number; tag: string };

const APPLIED_CHECKS: { tag: string; sql: string }[] = [
  {
    tag: "0000_legal_genesis",
    sql: "select to_regclass('public.agreements') is not null as applied",
  },
  {
    tag: "0001_safexy_model_v2",
    sql: "select to_regclass('public.extensions') is not null as applied",
  },
  {
    tag: "0002_notifications_data_kind",
    sql: "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='data') as applied",
  },
];

async function main() {
  // Migration 0002 recasts notification_kind and fails if old enum values
  // (e.g. GUARANTEE_REJECTED) remain. Only clear when 0002 is still pending so
  // rebuilds never wipe real notification rows.
  const notif = await pool.query<{ has_kind: boolean; has_data: boolean }>(
    `select exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='kind') as has_kind,
            exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='data') as has_data`,
  );
  const { has_kind, has_data } = notif.rows[0];
  if (has_kind && !has_data) {
    const cleared = await pool.query("delete from notifications");
    console.log(`Cleared notifications rows for 0002 enum recast: ${cleared.rowCount}`);
  } else {
    console.log(`notifications clear skipped (kind=${has_kind}, 0002_done=${has_data})`);
  }

  // The schema was created outside drizzle migrate() (journal empty). Detect
  // applied migrations by schema markers and backfill the journal so migrate()
  // only runs what is missing. drizzle skips by created_at (folderMillis) only.
  await pool.query("create schema if not exists drizzle");
  await pool.query(
    `create table if not exists drizzle.__drizzle_migrations (
       id serial primary key,
       hash text not null,
       created_at bigint
     )`,
  );

  const journal = JSON.parse(
    readFileSync("./drizzle/meta/_journal.json", "utf8"),
  ) as { entries: JournalEntry[] };

  for (const entry of journal.entries) {
    const check = APPLIED_CHECKS.find((c) => c.tag === entry.tag);
    if (!check) continue;
    const probe = await pool.query<{ applied: boolean }>(check.sql);
    if (!probe.rows[0]?.applied) {
      console.log(`Migration ${entry.tag}: not applied yet`);
      continue;
    }
    const existing = await pool.query(
      "select 1 from drizzle.__drizzle_migrations where created_at = $1",
      [entry.when],
    );
    if ((existing.rowCount ?? 0) > 0) {
      console.log(`Migration ${entry.tag}: already in journal`);
      continue;
    }
    await pool.query(
      "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
      [entry.tag, entry.when],
    );
    console.log(`Migration ${entry.tag}: backfilled journal (applied outside drizzle)`);
  }

  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
