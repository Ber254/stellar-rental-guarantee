import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { lookupByAlias } from "@/lib/services/contracts";

export async function GET(request: Request) {
  try {
    await requireUser();
    const alias = new URL(request.url).searchParams.get("alias") ?? "";
    const user = await lookupByAlias(alias);
    return Response.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
