import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { acceptContract } from "@/lib/services/contracts";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const contract = await acceptContract(user, id);
    return Response.json({ contract });
  } catch (error) {
    return errorResponse(error);
  }
}
