import { z } from "zod";

import { errorResponse } from "@/lib/api";
import { isAliasAvailable, isValidAlias, normalizeAlias, setAlias } from "@/lib/alias";
import { requireUser } from "@/lib/auth";
import { badRequest, conflict } from "@/lib/services/errors";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const raw = new URL(request.url).searchParams.get("alias") ?? "";
    const alias = normalizeAlias(raw);
    const valid = isValidAlias(alias);
    const available = valid && (await isAliasAvailable(alias, user.id));
    return Response.json({ alias, valid, available });
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({ alias: z.string().min(3).max(30) });

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { alias: raw } = schema.parse(await request.json());
    const alias = normalizeAlias(raw);
    if (!isValidAlias(alias)) throw badRequest("Invalid alias", "invalidAlias");
    if (!(await isAliasAvailable(alias, user.id))) {
      throw conflict("Alias already taken", "aliasTaken");
    }
    await setAlias(user.id, alias);
    return Response.json({ alias });
  } catch (error) {
    return errorResponse(error);
  }
}
