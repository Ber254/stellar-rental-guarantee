import { eq } from "drizzle-orm";
import { z } from "zod";

import { errorResponse } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppError } from "@/lib/services/errors";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()));

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new AppError("Invalid email or password", 401);
    }

    await createSession(user.id);
    return Response.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    return errorResponse(error);
  }
}
