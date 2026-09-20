import { z } from "zod";

import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rejectContract } from "@/lib/services/contracts";

const schema = z.object({ reason: z.string().min(1).max(500) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { reason } = schema.parse(await request.json());
    const contract = await rejectContract(user, id, reason);
    return Response.json({ contract });
  } catch (error) {
    return errorResponse(error);
  }
}
