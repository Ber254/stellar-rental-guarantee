import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { acceptInvitation } from "@/lib/services/contracts";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const user = await requireUser();
    const { token } = await params;
    const contract = await acceptInvitation(user, token);
    return Response.json({ contract });
  } catch (error) {
    return errorResponse(error);
  }
}
