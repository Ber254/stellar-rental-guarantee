import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ContractActions } from "@/components/contract-actions";
import { Alert, Card, Row, StatusBadge } from "@/components/ui";
import { WalletProvider } from "@/components/wallet";
import { getCurrentUser } from "@/lib/auth";
import { isChainConfigured } from "@/lib/env";
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
  const detail = await getContractDetail(id, user.id);
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
          <h1 className="text-2xl font-semibold">{property.label}</h1>
          <p className="text-sm text-slate-500">
            {contract.reference} · {property.address}
          </p>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      {!isChainConfigured() && (
        <Alert tone="warning">
          Demo mode: the escrow is simulated off-chain because no Soroban
          contract is configured. No Stellar transaction is submitted.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Contract">
          <dl>
            <Row label="Guarantee" value={formatUsdc(contract.guaranteeAmount)} />
            {contract.rentAmount && (
              <Row label="Monthly rent" value={formatUsdc(contract.rentAmount)} />
            )}
            <Row label="Lease" value={`${formatDate(contract.startDate)} → ${formatDate(contract.endDate)}`} />
            <Row label="Tenant" value={detail.tenant?.name ?? "—"} />
            <Row label="Landlord" value={detail.landlord?.name ?? contract.landlordName} />
            <Row
              label="Tenant wallet"
              value={<span className="font-mono">{shortenAddress(contract.tenantWallet)}</span>}
            />
            <Row
              label="Landlord wallet"
              value={<span className="font-mono">{shortenAddress(contract.landlordWallet)}</span>}
            />
            <Row label="Escrow status" value={guarantee?.status ?? "—"} />
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
        <Card title="Negotiation" description="Every round is kept for both parties.">
          <ol className="space-y-2">
            {detail.proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm"
              >
                <span>
                  Round {proposal.round} ·{" "}
                  {proposal.proposedByRole === "TENANT" ? "Tenant" : "Landlord"}:{" "}
                  {formatUsdc(proposal.toLandlord)} to landlord /{" "}
                  {formatUsdc(proposal.toTenant)} to tenant
                </span>
                <span className="text-xs font-medium uppercase text-slate-500">
                  {proposal.status}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="Stellar activity">
        {detail.transactions.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-none"
              >
                <span>
                  {tx.kind}
                  {tx.simulated && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-800">
                      simulated
                    </span>
                  )}
                </span>
                {tx.txHash ? (
                  <a
                    className="font-mono text-xs text-sky-700 underline"
                    href={explorerTxUrl(tx.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tx.txHash.slice(0, 10)}…
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">off-chain</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
