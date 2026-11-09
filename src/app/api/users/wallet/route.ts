import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rentalContracts, users } from "@/lib/db/schema";

const schema = z.object({
  stellarAddress: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address"),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { stellarAddress } = schema.parse(await request.json());

    await db
      .update(users)
      .set({ stellarAddress })
      .where(eq(users.id, user.id));

    await db
      .update(rentalContracts)
      .set({ landlordWallet: stellarAddress, updatedAt: new Date() })
      .where(
        and(
          eq(rentalContracts.landlordId, user.id),
          isNull(rentalContracts.landlordWallet),
        ),
      );

    return Response.json({ stellarAddress });
  } catch (error) {
    return errorResponse(error);
  }
}
