import Link from "next/link";
import { redirect } from "next/navigation";

import { HowItWorks } from "@/components/how-it-works";
import { Card, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatUsdc } from "@/lib/money";
import { listContracts } from "@/lib/services/contracts";

type Row = Awaited<ReturnType<typeof listContracts>>[number];

function GuaranteeList({ items, empty, t }: { items: Row[]; empty: string; t: Dictionary }) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">{empty}</p>
      </Card>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map(({ contract, property }) => (
        <li key={contract.id}>
          <Link href={`/contracts/${contract.id}`} className="block">
            <div className="flex items-center justify-between rounded-card border border-line bg-surface p-5 transition hover:border-accent">
              <div>
                <p className="font-medium text-fg">{property?.label ?? contract.reference}</p>
                <p className="text-sm text-muted">{contract.reference}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-fg">
                  {formatUsdc(contract.guaranteeAmount)}
                </span>
                <StatusBadge status={contract.status} label={t.status[contract.status]} />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [rows, locale] = await Promise.all([listContracts(user.id), getLocale()]);
  const t = getDictionary(locale);

  const given = rows.filter((row) => row.contract.guarantorId === user.id);
  const received = rows.filter((row) => row.contract.landlordId === user.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fg">{t.dashboard.title}</h1>
        <Link
          href="/contracts/new"
          className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
        >
          {t.dashboard.newGuarantee}
        </Link>
      </div>

      <HowItWorks label={t.dashboard.howItWorks} body={t.dashboard.howItWorksBody} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-fg">{t.dashboard.given}</h2>
        <GuaranteeList items={given} empty={t.dashboard.givenEmpty} t={t} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-fg">{t.dashboard.received}</h2>
        <GuaranteeList items={received} empty={t.dashboard.receivedEmpty} t={t} />
      </section>
    </div>
  );
}
