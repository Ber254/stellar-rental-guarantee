import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  getContractDetail,
  updateContractSchema,
  updatePendingContract,
} from "@/lib/services/contracts";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = updateContractSchema.parse(await request.json());
    const contract = await updatePendingContract(user, id, input);
    return Response.json({ contract });
  } catch (error) {
    return errorResponse(error);
  }
}
