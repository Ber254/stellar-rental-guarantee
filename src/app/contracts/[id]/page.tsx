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

const TX_LABELS_ES: Record<string, string> = {
  CREATE_GUARANTEE: "Escrow registrado en Stellar",
  FUND_GUARANTEE: "Depósito bloqueado en escrow",
  CANCEL_GUARANTEE: "Garantía cancelada",
  PROPOSE_SETTLEMENT: "Propuesta de devolución",
  ACCEPT_SETTLEMENT: "Propuesta de devolución aceptada",
  REJECT_SETTLEMENT: "Propuesta de devolución rechazada",
  EXECUTE_SETTLEMENT: "Fondos liberados del escrow",
  RETURN_TO_GUARANTOR: "Devolución unilateral al garante",
  PROPOSE_EXTENSION: "Extensión de garantía propuesta",
  ACCEPT_EXTENSION: "Extensión de garantía aceptada",
  CANCEL_EXTENSION: "Extensión de garantía retirada",
};

const TX_LABELS_EN: Record<string, string> = {
  CREATE_GUARANTEE: "Escrow registered on Stellar",
  FUND_GUARANTEE: "Deposit locked in escrow",
  CANCEL_GUARANTEE: "Guarantee cancelled",
  PROPOSE_SETTLEMENT: "Return proposal submitted",
  ACCEPT_SETTLEMENT: "Return proposal accepted",
  REJECT_SETTLEMENT: "Return proposal rejected",
  EXECUTE_SETTLEMENT: "Funds released from escrow",
  RETURN_TO_GUARANTOR: "Unilateral return to guarantor",
  PROPOSE_EXTENSION: "Guarantee extension proposed",
  ACCEPT_EXTENSION: "Guarantee extension accepted",
  CANCEL_EXTENSION: "Guarantee extension withdrawn",
};

const PROPOSAL_STATUS_ES: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  SUPERSEDED: "Superada",
};

const PROPOSAL_STATUS_EN: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  SUPERSEDED: "Superseded",
};

function stepIndexFor(status: string): number {
  switch (status) {
    case "DRAFT":
    case "PENDING_ACCEPTANCE":
      return 1;
    case "AWAITING_FUNDING":
      return 2;
    case "ACTIVE":
    case "EXPIRED":
      return 3;
    case "RETURN_REQUESTED":
    case "NEGOTIATION":
    case "AGREED":
      return 4;
    case "RELEASED":
    case "COMPLETED":
      return 5;
    default:
      return 0;
  }
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
  const isEs = locale === "es";
  const { contract, property, guarantee, role } = detail;
  const locked = guarantee?.lockedAmount ?? guarantee?.amount ?? contract.guaranteeAmount;
  const pending = detail.proposals.find((proposal) => proposal.status === "PENDING");
  const currentStep = stepIndexFor(contract.status);
  const steps = isEs
    ? ["1. Invitación", "2. Aceptada", "3. Protegida", "4. Devolución", "5. Cerrada"]
    : ["1. Invited", "2. Accepted", "3. Protected", "4. Return", "5. Closed"];

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-line bg-surface/90 p-6 shadow-lg shadow-black/15">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
                {property?.label ?? contract.reference}
              </h1>
              <span className="rounded border border-line bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                {role === "GUARANTOR" ? t.dashboard.roleGuarantor : t.dashboard.roleLandlord}
              </span>
            </div>
            <p className="font-mono text-xs text-muted sm:text-sm">
              {contract.reference}
              {property?.address ? ` · ${property.address}` : ""}
            </p>
          </div>
          <StatusBadge status={contract.status} label={t.status[contract.status]} />
        </div>

        {currentStep > 0 && (
          <div className="mt-6 grid grid-cols-5 gap-2 border-t border-line/60 pt-5">
            {steps.map((label, idx) => {
              const stepNum = idx + 1;
              const done = stepNum < currentStep || contract.status === "COMPLETED";
              const active = stepNum === currentStep && contract.status !== "COMPLETED";
              return (
                <div key={label} className="space-y-1.5">
                  <div
                    className={`h-1.5 rounded-full transition ${
                      done || active ? "bg-accent" : "bg-surface-muted"
                    }`}
                  />
                  <p
                    className={`text-[11px] font-medium ${
                      active ? "text-accent" : done ? "text-fg" : "text-muted"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid gap-3 border-t border-line/60 pt-5 sm:grid-cols-3">
          <div className="rounded-lg border border-line/70 bg-surface-muted/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {t.contract.locked}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-accent">
              {formatUsdc(locked)}
            </p>
          </div>
          <div className="rounded-lg border border-line/70 bg-surface-muted/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {t.contract.guarantee}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-fg">
              {formatUsdc(contract.guaranteeAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-line/70 bg-surface-muted/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {t.contract.lease}
            </p>
            <p className="mt-1.5 font-mono text-sm font-semibold text-fg">
              {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
            </p>
          </div>
        </div>
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
          <ol className="space-y-2.5">
            {detail.proposals.map((proposal) => {
              const statusLabel =
                (isEs ? PROPOSAL_STATUS_ES : PROPOSAL_STATUS_EN)[proposal.status] ??
                proposal.status;
              return (
                <li
                  key={proposal.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-muted/70 px-4 py-3 text-sm text-fg"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      <span className="mr-2 rounded bg-accent/15 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                        {t.contract.round} {proposal.round}
                      </span>
                      {proposal.proposedByRole === "GUARANTOR"
                        ? t.dashboard.roleGuarantor
                        : t.dashboard.roleLandlord}
                      :{" "}
                      {interpolate(t.contract.splitLine, {
                        guarantor: String(Number(proposal.toGuarantor)),
                        landlord: String(Number(proposal.toLandlord)),
                      })}
                    </p>
                    {proposal.reason && (
                      <p className="text-xs text-muted">“{proposal.reason}”</p>
                    )}
                  </div>
                  <span className="rounded-badge border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                    {statusLabel}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <Card title={t.contract.activityTitle}>
        {detail.transactions.length === 0 ? (
          <p className="text-sm text-muted">{t.contract.noActivity}</p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {detail.transactions.map((tx) => {
              const humanKind =
                (isEs ? TX_LABELS_ES : TX_LABELS_EN)[tx.kind] ?? tx.kind;
              return (
                <li
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line/70 bg-surface-muted/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <span className="font-medium text-fg">{humanKind}</span>
                    <span className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {tx.kind}
                    </span>
                    {tx.simulated && (
                      <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[10px] uppercase text-warn-fg">
                        {t.contract.simulated}
                      </span>
                    )}
                  </div>
                  {tx.txHash ? (
                    <a
                      className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-xs font-medium text-accent transition hover:bg-accent/20"
                      href={explorerTxUrl(tx.txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tx.txHash.slice(0, 10)}… ↗
                    </a>
                  ) : (
                    <span className="text-xs text-muted">{t.contract.offChain}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
