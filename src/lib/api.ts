import { ZodError } from "zod";

import { UnauthorizedError } from "@/lib/auth";
import { AppError } from "@/lib/services/errors";

export function errorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return Response.json(
      { error: "You need to sign in", code: "signInRequired" },
      { status: 401 },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: error.issues[0]?.message ?? "Invalid request",
        code: "invalidInput",
        issues: error.issues,
      },
      { status: 422 },
    );
  }
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    { error: error instanceof Error ? error.message : "Unexpected error", code: "unexpected" },
    { status: 500 },
  );
}
