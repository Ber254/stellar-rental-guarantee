import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userAliasHistory, users } from "@/lib/db/schema";

/** Lowercase letters, digits, dot, dash, underscore. 3-30 chars, no leading/trailing separator. */
export const ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export function normalizeAlias(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidAlias(alias: string): boolean {
  return ALIAS_PATTERN.test(alias);
}

export async function isAliasAvailable(alias: string, excludeUserId?: string) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.alias, alias));
  return !existing || existing.id === excludeUserId;
}

/** Records the previous alias so old references can show "now known as @new". */
export async function setAlias(userId: string, alias: string) {
  const [previous] = await db
    .select({ alias: users.alias })
    .from(users)
    .where(eq(users.id, userId));

  await db.update(users).set({ alias }).where(eq(users.id, userId));

  if (previous?.alias) {
    await db.insert(userAliasHistory).values({ userId, alias: previous.alias });
  }
}

export async function findUserByAlias(alias: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.alias, alias));
  return user ?? null;
}
