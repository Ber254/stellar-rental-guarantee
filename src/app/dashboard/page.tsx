import Link from "next/link";
import { redirect } from "next/navigation";

import { HowItWorks } from "@/components/how-it-works";
import { Card, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatUsdc, fromStroops, toStroops } from "@/lib/money";
import { listContracts } from "@/lib/services/contracts";

type Row = Awaited<ReturnType<typeof listContracts>>[number];

function formatDate(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function GuaranteeList({
  items,
  empty,
  roleLabel,
  t,
}: {
  items: Row[];
  empty: string;
  roleLabel: string;
  t: Dictionary;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">{empty}</p>
      </Card>
    );
  }
  return (
    <ul className="grid gap-3">
      {items.map(({ contract, property, guarantee }) => {
        const locked =
          guarantee?.lockedAmount ?? guarantee?.amount ?? contract.guaranteeAmount;
        const hasPartial =
          guarantee?.lockedAmount &&
          Number(guarantee.lockedAmount) < Number(contract.guaranteeAmount) &&
          Number(guarantee.lockedAmount) > 0;
        return (
          <li key={contract.id}>
            <Link href={`/contracts/${contract.id}`} className="group block">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface/90 p-5 shadow-md shadow-black/10 transition group-hover:border-accent group-hover:bg-surface-muted/70">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-fg group-hover:text-accent">
                      {property?.label ?? contract.reference}
                    </p>
                    <span className="rounded border border-line bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                      {roleLabel}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted">
                    {contract.reference}
                    {property?.address ? ` · ${property.address}` : ""} ·{" "}
                    {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono text-base font-bold text-fg">
                      {formatUsdc(locked)}
                    </p>
                    {hasPartial && (
                      <p className="text-[11px] text-muted">
                        {t.contract.guarantee}: {formatUsdc(contract.guaranteeAmount)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={contract.status} label={t.status[contract.status]} />
                  <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent">
                    →
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
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

  const totalLockedStroops = rows.reduce((sum, { guarantee }) => {
    if (guarantee?.status !== "LOCKED") {
      return sum;
    }
    const locked = guarantee.lockedAmount ?? guarantee.amount;
    return sum + toStroops(locked);
  }, 0n);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            {t.dashboard.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            @{user.alias ?? user.name}
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-2 rounded-card bg-gradient-to-r from-[#12A8FF] via-[#3B68FF] to-[#6D28D9] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#3B68FF]/25 transition hover:brightness-110"
        >
          <span>+</span>
          {t.dashboard.newGuarantee}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface/90 p-5 shadow-md shadow-black/10">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {t.contract.locked}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-accent">
            {formatUsdc(fromStroops(totalLockedStroops))}
          </p>
        </div>
        <div className="rounded-card border border-line bg-surface/90 p-5 shadow-md shadow-black/10">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {t.dashboard.given}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-fg">{given.length}</p>
        </div>
        <div className="rounded-card border border-line bg-surface/90 p-5 shadow-md shadow-black/10">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {t.dashboard.received}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-fg">{received.length}</p>
        </div>
      </div>

      <HowItWorks label={t.dashboard.howItWorks} body={t.dashboard.howItWorksBody} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-fg">{t.dashboard.given}</h2>
        <GuaranteeList
          items={given}
          empty={t.dashboard.givenEmpty}
          roleLabel={t.dashboard.roleGuarantor}
          t={t}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-fg">{t.dashboard.received}</h2>
        <GuaranteeList
          items={received}
          empty={t.dashboard.receivedEmpty}
          roleLabel={t.dashboard.roleLandlord}
          t={t}
        />
      </section>
    </div>
  );
}
