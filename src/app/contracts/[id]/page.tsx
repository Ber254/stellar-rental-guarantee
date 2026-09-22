import { redirect } from "next/navigation";

import { ContractActions } from "@/components/contract-actions";
import { HowItWorks } from "@/components/how-it-works";
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
  const locked = guarantee?.lockedAmount ?? guarantee?.amount ?? contract.guaranteeAmount;

  const pending = detail.proposals.find((proposal) => proposal.status === "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            {property?.label ?? contract.reference}
          </h1>
          <p className="text-sm text-muted">
            {contract.reference}
            {property?.address ? ` · ${property.address}` : ""}
          </p>
        </div>
        <StatusBadge status={contract.status} label={t.status[contract.status]} />
      </div>

      {!isChainConfigured() && <Alert tone="warning">{t.contract.demoWarning}</Alert>}
      {contract.status === "REJECTED" && contract.rejectionReason && (
        <Alert tone="error">
          {t.contract.rejectionReason}: {contract.rejectionReason}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.contract.detailsTitle}>
          <dl>
            <Row label={t.contract.reference} value={contract.reference} />
            <Row
              label={t.contract.guarantee}
              value={formatUsdc(contract.guaranteeAmount)}
            />
            <Row label={t.contract.locked} value={formatUsdc(locked)} />
            {contract.rentAmount && (
              <Row label={t.contract.rent} value={formatUsdc(contract.rentAmount)} />
            )}
            <Row
              label={t.contract.lease}
              value={`${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}`}
            />
            <Row
              label={t.contract.guarantor}
              value={detail.guarantor ? `@${detail.guarantor.alias ?? detail.guarantor.name}` : "—"}
            />
            <Row
              label={t.contract.landlord}
              value={detail.landlord ? `@${detail.landlord.alias ?? detail.landlord.name}` : "—"}
            />
            <Row
              label={t.contract.guarantorWallet}
              value={
                <span className="font-mono">{shortenAddress(contract.guarantorWallet)}</span>
              }
            />
            <Row
              label={t.contract.landlordWallet}
              value={
                contract.landlordWallet ? (
                  <span className="font-mono">{shortenAddress(contract.landlordWallet)}</span>
                ) : (
                  <span className="text-muted">{t.contract.landlordNoWallet}</span>
                )
              }
            />
            <Row
              label={t.contract.escrowStatus}
              value={guarantee ? t.guaranteeStatus[guarantee.status] : "—"}
            />
          </dl>
          <div className="mt-4">
            <HowItWorks label={t.contract.howItWorks} body={t.contract.howItWorksBody} />
          </div>
        </Card>

        <WalletProvider networkPassphrase={networkConfig().networkPassphrase}>
          <ContractActions
            contractId={contract.id}
            role={role}
            status={contract.status}
            landlordName={detail.landlord?.name ?? "—"}
            locked={locked}
            escrowRegistered={Boolean(guarantee?.sorobanContractId) || !isChainConfigured()}
            pendingProposal={
              pending
                ? {
                    id: pending.id,
                    toGuarantor: pending.toGuarantor,
                    toLandlord: pending.toLandlord,
                    mine: pending.proposedBy === user.id,
                  }
                : null
            }
            pendingExtension={
              detail.pendingExtension
                ? {
                    proposedNewAmount: detail.pendingExtension.proposedNewAmount,
                    proposedNewEndDate: detail.pendingExtension.proposedNewEndDate.toISOString(),
                  }
                : null
            }
            editableDefaults={{
              guaranteeAmount: contract.guaranteeAmount,
              rentAmount: contract.rentAmount ?? "",
              startDate: formatDate(contract.startDate),
              endDate: formatDate(contract.endDate),
              notes: contract.notes ?? "",
            }}
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
                  {proposal.proposedByRole === "GUARANTOR"
                    ? t.dashboard.roleGuarantor
                    : t.dashboard.roleLandlord}
                  :{" "}
                  {interpolate(t.contract.splitLine, {
                    guarantor: formatUsdc(proposal.toGuarantor),
                    landlord: formatUsdc(proposal.toLandlord),
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
