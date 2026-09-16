import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env";

const SESSION_COOKIE = "rg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const secretKey = () => new TextEncoder().encode(serverEnv.authSecret());

export const hashPassword = (password: string) => hash(password, 10);

export const verifyPassword = (password: string, passwordHash: string) =>
  compare(password, passwordHash);

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = payload.sub;
    if (!userId) return null;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
