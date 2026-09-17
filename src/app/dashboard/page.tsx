import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatUsdc } from "@/lib/money";
import { listContracts } from "@/lib/services/contracts";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [rows, locale] = await Promise.all([listContracts(user.id), getLocale()]);
  const t = getDictionary(locale);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fg">{t.dashboard.title}</h1>
        <Link
          href="/contracts/new"
          className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
        >
          {t.nav.newContract}
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t.dashboard.empty}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ contract, property }) => (
            <li key={contract.id}>
              <Link href={`/contracts/${contract.id}`} className="block">
                <div className="flex items-center justify-between rounded-card border border-line bg-surface p-5 transition hover:border-accent">
                  <div>
                    <p className="font-medium text-fg">{property.label}</p>
                    <p className="text-sm text-muted">
                      {contract.reference} ·{" "}
                      {contract.tenantId === user.id
                        ? t.dashboard.roleTenant
                        : t.dashboard.roleLandlord}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-fg">
                      {formatUsdc(contract.guaranteeAmount)}
                    </span>
                    <StatusBadge
                      status={contract.status}
                      label={t.status[contract.status]}
                    />
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
