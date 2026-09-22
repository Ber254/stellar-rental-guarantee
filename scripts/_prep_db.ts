import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

async function uniqueBackupName(): Promise<string> {
  for (let i = 0; ; i++) {
    const name = i === 0 ? "public_pre_v2_backup" : `public_pre_v2_backup_${i}`;
    const taken = await pool.query(
      "select exists(select 1 from information_schema.schemata where schema_name = $1) as taken",
      [name],
    );
    if (!taken.rows[0].taken) return name;
  }
}

async function main() {
  const state = await pool.query<{
    has_agreements: boolean;
    has_extensions: boolean;
  }>(
    "select to_regclass('public.agreements') is not null as has_agreements," +
      " to_regclass('public.extensions') is not null as has_extensions",
  );
  const { has_agreements, has_extensions } = state.rows[0];
  console.log(`DB state: public.agreements=${has_agreements} public.extensions=${has_extensions}`);

  // The linked DATABASE_URL still carries the old app's schema, which is not
  // the shape migrations 0000..0002 expect (no enum types, no extensions).
  // Move it aside instead of dropping it so nothing is destroyed, then let
  // drizzle build a fresh public schema.
  if (has_agreements && !has_extensions) {
    const backup = await uniqueBackupName();
    await pool.query("drop schema if exists drizzle cascade");
    await pool.query(`alter schema public rename to "${backup}"`);
    await pool.query("create schema public");
    console.log(`Old schema preserved as ${backup}; fresh public created (journal reset).`);
  } else {
    console.log("No incompatible old schema detected; leaving public untouched.");
  }

  await pool.query("create schema if not exists public");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
