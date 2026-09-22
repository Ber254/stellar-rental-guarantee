import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { cancelPendingContract } from "@/lib/services/contracts";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const contract = await cancelPendingContract(user, id);
    return Response.json({ contract });
  } catch (error) {
    return errorResponse(error);
  }
}
