import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ContractActions } from "@/components/contract-actions";
import { Alert, Card, Row, StatusBadge } from "@/components/ui";
import { WalletProvider } from "@/components/wallet";
import { getCurrentUser } from "@/lib/auth";
import { isChainConfigured } from "@/lib/env";
import { getDictionary, interpolate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatUsdc } from "@/lib/money";
import { getContractDetail } from "@/lib/services/contracts";
import { explorerTxUrl, networkConfig, shortenAddress } from "@/lib/stellar/network";

function formatDate(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [detail, locale] = await Promise.all([
    getContractDetail(id, user.id),
    getLocale(),
  ]);
  const t = getDictionary(locale);
  const { contract, property, guarantee, role } = detail;

  const pending = detail.proposals.find((proposal) => proposal.status === "PENDING");
  const host = (await headers()).get("host");
  const inviteUrl =
    role === "TENANT" && contract.status === "PENDING_ACCEPTANCE" && host
      ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/invite/${contract.inviteToken}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{property.label}</h1>
          <p className="text-sm text-muted">
            {contract.reference} · {property.address}
          </p>
        </div>
        <StatusBadge status={contract.status} label={t.status[contract.status]} />
      </div>

      {!isChainConfigured() && <Alert tone="warning">{t.contract.demoWarning}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.contract.detailsTitle}>
          <dl>
            <Row
              label={t.contract.guarantee}
              value={formatUsdc(contract.guaranteeAmount)}
            />
            {contract.rentAmount && (
              <Row label={t.contract.rent} value={formatUsdc(contract.rentAmount)} />
            )}
            <Row
              label={t.contract.lease}
              value={`${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}`}
            />
            <Row label={t.contract.tenant} value={detail.tenant?.name ?? "—"} />
            <Row
              label={t.contract.landlord}
              value={detail.landlord?.name ?? contract.landlordName}
            />
            <Row
              label={t.contract.tenantWallet}
              value={
                <span className="font-mono">{shortenAddress(contract.tenantWallet)}</span>
              }
            />
            <Row
              label={t.contract.landlordWallet}
              value={
                <span className="font-mono">
                  {shortenAddress(contract.landlordWallet)}
                </span>
              }
            />
            <Row
              label={t.contract.escrowStatus}
              value={guarantee ? t.guaranteeStatus[guarantee.status] : "—"}
            />
          </dl>
        </Card>

        <WalletProvider networkPassphrase={networkConfig().networkPassphrase}>
          <ContractActions
            contractId={contract.id}
            role={role}
            status={contract.status}
            amount={contract.guaranteeAmount}
            escrowRegistered={Boolean(guarantee?.sorobanContractId) || !isChainConfigured()}
            pendingProposal={
              pending
                ? {
                    id: pending.id,
                    toLandlord: pending.toLandlord,
                    toTenant: pending.toTenant,
                    mine: pending.proposedBy === user.id,
                  }
                : null
            }
            inviteUrl={inviteUrl}
          />
        </WalletProvider>
      </div>

      {detail.proposals.length > 0 && (
        <Card
          title={t.contract.negotiationTitle}
          description={t.contract.negotiationDescription}
        >
          <ol className="space-y-2">
            {detail.proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex items-center justify-between rounded-card border border-line bg-surface-muted px-4 py-3 text-sm text-fg"
              >
                <span>
                  {t.contract.round} {proposal.round} ·{" "}
                  {proposal.proposedByRole === "TENANT"
                    ? t.dashboard.roleTenant
                    : t.dashboard.roleLandlord}
                  :{" "}
                  {interpolate(t.contract.splitLine, {
                    landlord: formatUsdc(proposal.toLandlord),
                    tenant: formatUsdc(proposal.toTenant),
                  })}
                </span>
                <span className="text-xs font-medium uppercase text-muted">
                  {proposal.status}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title={t.contract.activityTitle}>
        {detail.transactions.length === 0 ? (
          <p className="text-sm text-muted">{t.contract.noActivity}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-4 border-b border-line pb-2 last:border-none"
              >
                <span className="text-fg">
                  {tx.kind}
                  {tx.simulated && (
                    <span className="ml-2 rounded bg-warn-bg px-1.5 py-0.5 text-[10px] uppercase text-warn-fg">
                      {t.contract.simulated}
                    </span>
                  )}
                </span>
                {tx.txHash ? (
                  <a
                    className="font-mono text-xs text-accent underline"
                    href={explorerTxUrl(tx.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tx.txHash.slice(0, 10)}…
                  </a>
                ) : (
                  <span className="text-xs text-muted">{t.contract.offChain}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
