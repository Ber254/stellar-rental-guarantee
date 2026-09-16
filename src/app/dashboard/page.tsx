import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatUsdc } from "@/lib/money";
import { listContracts } from "@/lib/services/contracts";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await listContracts(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your guarantees</h1>
        <Link
          href="/contracts/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          New contract
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            No contracts yet. Create one as a tenant and invite your landlord.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ contract, property }) => (
            <li key={contract.id}>
              <Link href={`/contracts/${contract.id}`} className="block">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400">
                  <div>
                    <p className="font-medium text-slate-900">{property.label}</p>
                    <p className="text-sm text-slate-500">
                      {contract.reference} ·{" "}
                      {contract.tenantId === user.id ? "Tenant" : "Landlord"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {formatUsdc(contract.guaranteeAmount)}
                    </span>
                    <StatusBadge status={contract.status} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
