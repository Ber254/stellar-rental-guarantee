import { AppError } from "./services/errors";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

/**
 * Sliding-window in-memory rate limiter keyed by route + client IP.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; remaining: number } {
  const cutoff = now - windowMs;
  const current = buckets.get(key)?.timestamps.filter((t) => t > cutoff) ?? [];
  if (current.length >= limit) {
    buckets.set(key, { timestamps: current });
    return { allowed: false, remaining: 0 };
  }
  current.push(now);
  buckets.set(key, { timestamps: current });
  return { allowed: true, remaining: limit - current.length };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 60_000,
) {
  const key = `${scope}:${clientIp(request)}`;
  const { allowed } = checkRateLimit(key, limit, windowMs);
  if (!allowed) {
    throw new AppError("Too many requests. Please wait a moment.", 429, "unexpected");
  }
}
