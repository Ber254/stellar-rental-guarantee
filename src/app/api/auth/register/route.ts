import { eq } from "drizzle-orm";
import { z } from "zod";

import { errorResponse } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { conflict } from "@/lib/services/errors";

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
  stellarAddress: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/)
    .optional()
    .or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const email = input.email.toLowerCase();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (existing) throw conflict("That email is already registered");

    const [user] = await db
      .insert(users)
      .values({
        name: input.name,
        email,
        passwordHash: await hashPassword(input.password),
        stellarAddress: input.stellarAddress || null,
      })
      .returning();

    await createSession(user.id);
    return Response.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    return errorResponse(error);
  }
}
