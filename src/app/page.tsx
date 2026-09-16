import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";

const STEPS = [
  ["1. Contract", "The tenant registers the rental and invites the landlord."],
  ["2. Lock", "The deposit is locked in USDC inside a Soroban escrow."],
  ["3. Return", "At the end of the lease the tenant asks for the deposit back."],
  ["4. Agreement", "Both parties propose and counter until they agree on a split."],
  ["5. Release", "The escrow pays exactly the agreed amounts on Stellar."],
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">
          A rental deposit that neither side can touch alone
        </h1>
        <p className="max-w-2xl text-slate-600">
          The guarantee is locked in USDC on Stellar. It is released only when
          the tenant and the landlord agree on how to split it — the platform
          never decides who is right and never holds the keys.
        </p>
        <div className="flex gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>

      <Card title="How it works">
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map(([title, body]) => (
            <li key={title} className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
