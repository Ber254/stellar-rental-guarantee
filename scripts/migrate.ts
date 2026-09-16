import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
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

async function main() {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrations applied");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
