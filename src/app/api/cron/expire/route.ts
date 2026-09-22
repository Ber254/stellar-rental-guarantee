import { expireStaleContracts } from "@/lib/services/contracts";

/**
 * Scheduled by Vercel Cron (see vercel.json). Vercel signs the request with
 * `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET is
 * set as an env var, so this checks that instead of trusting the caller.
 * Without CRON_SECRET configured, the endpoint refuses every request —
 * there is no "open" mode, since this can cancel or expire real guarantees.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expireStaleContracts();
  return Response.json({ ok: true, ...result });
}
