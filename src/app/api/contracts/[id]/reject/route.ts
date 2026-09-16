import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { rejectProposal } from "@/lib/services/chain";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await rejectProposal(user, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
