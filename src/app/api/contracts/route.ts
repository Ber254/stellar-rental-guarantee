import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  createContractSchema,
  createRentalContract,
  listContracts,
} from "@/lib/services/contracts";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ contracts: await listContracts(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createContractSchema.parse(await request.json());
    const contract = await createRentalContract(user, input);
    return Response.json({ contract }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
