import { redirect } from "next/navigation";

import { CertificateToolbar, QrCodeSvg } from "@/components/certificate-view";
import { StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatUsdc } from "@/lib/money";
import { getContractDetail } from "@/lib/services/contracts";
import { explorerTxUrl, networkConfig } from "@/lib/stellar/network";

function formatDate(value: Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export default async function ContractCertificatePage({
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
  const { contract, property, guarantee } = detail;
  const locked =
    guarantee?.lockedAmount ?? guarantee?.amount ?? contract.guaranteeAmount;
  const cfg = networkConfig();
  const sorobanContractId =
    guarantee?.sorobanContractId ??
    cfg.guaranteeContractId ??
    "CCAT2N5JSRUO2UJDB7RFSUG2FWUO2X77VJBSVLVTZI2VDZOSOYSH76LV";

  const latestRealTx = detail.transactions.find((tx) => tx.txHash && !tx.simulated);
  const explorerUrl = latestRealTx?.txHash
    ? explorerTxUrl(latestRealTx.txHash)
    : `https://stellar.expert/explorer/testnet/contract/${sorobanContractId}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <CertificateToolbar
        contractId={contract.id}
        backLabel={isEs ? "Volver a la garantía" : "Back to guarantee"}
        printLabel={
          isEs ? "Imprimir / Guardar PDF" : "Print / Save as PDF"
        }
      />

      <div className="rounded-card border-2 border-accent/40 bg-surface p-8 shadow-2xl print:border-black print:bg-white print:text-black print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/safexy-icon.png"
                alt="Safexy"
                className="h-10 w-auto"
              />
              <div>
                <p className="text-xl font-extrabold lowercase tracking-tight text-fg print:text-black">
                  safexy
                </p>
                <p className="text-xs text-muted print:text-gray-600">
                  {isEs
                    ? "Certificado de Garantía en Escrow No Custodial · Stellar Network"
                    : "Non-Custodial Escrow Guarantee Certificate · Stellar Network"}
                </p>
              </div>
            </div>
            <h1 className="pt-2 text-2xl font-bold tracking-tight text-fg print:text-black">
              {property?.label ?? contract.reference}
            </h1>
            {property?.address && (
              <p className="text-sm text-muted print:text-gray-600">
                {property.address}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <StatusBadge
              status={contract.status}
              label={t.status[contract.status]}
            />
            <p className="font-mono text-xs text-muted print:text-gray-600">
              Ref: {contract.reference}
            </p>
            {guarantee?.onChainId && (
              <p className="font-mono text-xs text-muted print:text-gray-600">
                On-Chain ID: {guarantee.onChainId}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-muted/70 p-4 print:border-gray-300 print:bg-gray-50">
            <p className="text-xs font-medium uppercase tracking-wider text-muted print:text-gray-600">
              {t.contract.locked}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-accent print:text-blue-700">
              {formatUsdc(locked)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-muted/70 p-4 print:border-gray-300 print:bg-gray-50">
            <p className="text-xs font-medium uppercase tracking-wider text-muted print:text-gray-600">
              {t.contract.guarantee}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-fg print:text-black">
              {formatUsdc(contract.guaranteeAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-muted/70 p-4 print:border-gray-300 print:bg-gray-50">
            <p className="text-xs font-medium uppercase tracking-wider text-muted print:text-gray-600">
              {t.contract.lease}
            </p>
            <p className="mt-1.5 font-mono text-sm font-semibold text-fg print:text-black">
              {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-line/70 bg-surface-muted/40 p-4 print:border-gray-300">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent print:text-blue-700">
              {t.contract.guarantor}
            </p>
            <p className="text-base font-semibold text-fg print:text-black">
              {detail.guarantor
                ? [detail.guarantor.name, detail.guarantor.lastName]
                    .filter(Boolean)
                    .join(" ")
                : "—"}
            </p>
            <p className="font-mono text-xs text-muted print:text-gray-600">
              @{detail.guarantor?.alias ?? "—"}
            </p>
            <p className="break-all font-mono text-[11px] text-muted print:text-gray-600">
              {contract.guarantorWallet}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-line/70 bg-surface-muted/40 p-4 print:border-gray-300">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent print:text-blue-700">
              {t.contract.landlord}
            </p>
            <p className="text-base font-semibold text-fg print:text-black">
              {detail.landlord
                ? [detail.landlord.name, detail.landlord.lastName]
                    .filter(Boolean)
                    .join(" ")
                : "—"}
            </p>
            <p className="font-mono text-xs text-muted print:text-gray-600">
              @{detail.landlord?.alias ?? "—"}
            </p>
            <p className="break-all font-mono text-[11px] text-muted print:text-gray-600">
              {contract.landlordWallet ?? t.contract.landlordNoWallet}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-6">
          <div className="max-w-xl space-y-2 text-xs text-muted print:text-gray-700">
            <p className="font-semibold uppercase tracking-wider text-fg print:text-black">
              {isEs
                ? "Verificación criptográfica en Stellar (Soroban)"
                : "Cryptographic verification on Stellar (Soroban)"}
            </p>
            <p>
              {isEs
                ? "Los fondos en USDC están protegidos por un contrato inteligente Soroban no custodial. Ninguna de las partes ni Safexy puede retirar fondos unilateralmente en su propio favor."
                : "The USDC funds are protected by a non-custodial Soroban smart contract. Neither party nor Safexy can unilaterally withdraw funds in their own favor."}
            </p>
            <p className="break-all font-mono text-[11px] text-fg print:text-black">
              Soroban Escrow Contract: {sorobanContractId}
            </p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block break-all font-mono text-[11px] text-accent underline print:text-blue-700"
            >
              {explorerUrl}
            </a>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <QrCodeSvg value={explorerUrl} size={132} />
            <span className="font-mono text-[10px] text-muted print:text-gray-600">
              {isEs ? "Escanear en Stellar Expert" : "Scan on Stellar Expert"}
            </span>
          </div>
        </div>

        {detail.transactions.length > 0 && (
          <div className="mt-6 border-t border-line pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg print:text-black">
              {isEs
                ? "Registro de transacciones on-chain"
                : "On-chain transaction log"}
            </p>
            <div className="space-y-1.5 font-mono text-xs">
              {detail.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-line/60 bg-surface-muted/30 px-3 py-1.5 print:border-gray-300"
                >
                  <span className="font-semibold text-fg print:text-black">
                    {tx.kind}
                  </span>
                  <span className="break-all text-[11px] text-muted print:text-gray-700">
                    {tx.txHash ?? (isEs ? "Simulado" : "Simulated")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
