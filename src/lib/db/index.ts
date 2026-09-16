import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

type Database =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzleNode<typeof schema>>;

const globalForDb = globalThis as unknown as { db?: Database; pool?: Pool };

const createDb = (): Database => {
  const url = serverEnv.databaseUrl();
  if (url.includes("neon.tech")) {
    return drizzleNeon(neon(url), { schema });
  }
  const pool = globalForDb.pool ?? new Pool({ connectionString: url });
  globalForDb.pool = pool;
  return drizzleNode(pool, { schema });
};

export const db: Database = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export { schema };
