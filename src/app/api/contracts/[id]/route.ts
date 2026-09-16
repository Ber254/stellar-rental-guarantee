import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getContractDetail } from "@/lib/services/contracts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return Response.json(await getContractDetail(id, user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
