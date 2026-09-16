export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string) => new AppError(message, 400);
export const forbidden = (message: string) => new AppError(message, 403);
export const notFound = (message: string) => new AppError(message, 404);
export const conflict = (message: string) => new AppError(message, 409);
