import { z } from "zod";

import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  CHAIN_STEPS,
  completeStep,
  proposePayloadSchema,
  startStep,
} from "@/lib/services/chain";

const schema = z.object({
  step: z.enum(CHAIN_STEPS),
  propose: proposePayloadSchema.optional(),
  signedXdr: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = schema.parse(await request.json());
    const payload = { propose: body.propose };

    const outcome = body.signedXdr
      ? await completeStep(user, id, body.step, payload, body.signedXdr)
      : await startStep(user, id, body.step, payload);

    return Response.json(outcome);
  } catch (error) {
    return errorResponse(error);
  }
}
