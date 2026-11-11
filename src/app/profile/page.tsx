import { redirect } from "next/navigation";
import Link from "next/link";

import { Card, Row } from "@/components/ui";
import { ProfileAlias } from "@/components/profile-alias";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatUsdc, toStroops, fromStroops } from "@/lib/money";
import { listContracts } from "@/lib/services/contracts";
import { fetchUsdcBalance, shortenAddress } from "@/lib/stellar/network";

const COMMITTED_STATUSES = new Set([
  "PENDING_ACCEPTANCE",
  "AWAITING_FUNDING",
  "ACTIVE",
  "RETURN_REQUESTED",
  "NEGOTIATION",
  "AGREED",
  "EXPIRED",
]);

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [rows, locale, walletBalance] = await Promise.all([
    listContracts(user.id),
    getLocale(),
    user.stellarAddress ? fetchUsdcBalance(user.stellarAddress) : Promise.resolve(null),
  ]);
  const t = getDictionary(locale);

  const committed = rows
    .filter((row) => row.contract.guarantorId === user.id && COMMITTED_STATUSES.has(row.contract.status))
    .reduce((total, row) => {
      const locked = row.guarantee?.lockedAmount ?? row.guarantee?.amount ?? row.contract.guaranteeAmount;
      return total + toStroops(locked);
    }, 0n);

  const available =
    walletBalance !== null ? toStroops(walletBalance) - committed : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-fg">{t.profile.title}</h1>

      <Card>
        <div className="space-y-4">
          <ProfileAlias alias={user.alias} />
          <dl>
            <Row label={t.auth.name} value={[user.name, user.lastName].filter(Boolean).join(" ")} />
            <Row label={t.auth.email} value={user.email} />
            <Row
              label={t.profile.wallet}
              value={
                user.stellarAddress ? (
                  <span className="font-mono">{shortenAddress(user.stellarAddress)}</span>
                ) : (
                  <span className="text-muted">{t.profile.noWallet}</span>
                )
              }
            />
            {walletBalance !== null && (
              <Row label={t.profile.walletBalance} value={formatUsdc(walletBalance)} />
            )}
          </dl>
        </div>
      </Card>

      {available !== null ? (
        <Card title={t.profile.availableBalanceReal} description={t.profile.balanceHintReal}>
          <p className="font-mono text-2xl font-bold text-accent">
            {formatUsdc(fromStroops(available < 0n ? 0n : available))}
          </p>
        </Card>
      ) : (
        <Card title={t.profile.availableBalance} description={t.profile.balanceHint}>
          <p className="font-mono text-2xl font-bold text-fg">{formatUsdc(fromStroops(committed))}</p>
        </Card>
      )}

      <Card
        title={
          locale === "es"
            ? "Rampa ARS ↔ USDC & Configuración Stellar Testnet"
            : "ARS ↔ USDC Ramp & Stellar Testnet Setup"
        }
        description={
          locale === "es"
            ? "Cómo fondear o retirar USDC en Stellar (Anchors SEP-24, Varial Swap y Testnet)."
            : "How to fund or withdraw USDC on Stellar (SEP-24 Anchors, Varial Swap, and Testnet)."
        }
      >
        <div className="space-y-3 text-xs text-muted">
          <div className="rounded-lg border border-line/70 bg-surface-muted/50 p-3.5">
            <p className="font-semibold text-fg">
              {locale === "es"
                ? "1. Billetera recomendada: Varial (ex-Freighter)"
                : "1. Recommended wallet: Varial (formerly Freighter)"}
            </p>
            <p className="mt-1">
              {locale === "es"
                ? "En producción (Mainnet), podés convertir ARS ↔ USDC mediante Anchors SEP-24 del ecosistema Stellar en Argentina/LATAM o hacer Swap directo XLM ↔ USDC dentro de Varial."
                : "In production (Mainnet), you can convert local currency ↔ USDC through Stellar SEP-24 Anchors or swap XLM ↔ USDC directly inside Varial."}
            </p>
          </div>
          <div className="rounded-lg border border-line/70 bg-surface-muted/50 p-3.5 font-mono">
            <p className="font-sans font-semibold text-fg">
              {locale === "es"
                ? "2. Parámetros del activo USDC en Stellar Testnet"
                : "2. USDC Asset Parameters on Stellar Testnet"}
            </p>
            <p className="mt-1 break-all">
              Asset Code: USDC · Issuer: GANGXXPF6NIMUR4CEAFIOCSQH7UMQRCA5SQN6N3NCXOPGMNXNVD5X3HA
            </p>
            <p className="mt-1 break-all">
              USDC SAC: CDSA3RLXVDMZGV6ZWDZY3HKFDJT2ZSEUCHPMG3OQXQUNU5W64XMHCIIO
            </p>
          </div>
          <Link
            href="/how-to-fund"
            className="inline-flex rounded-card border border-line bg-surface px-3 py-2 text-xs font-semibold text-fg transition hover:border-accent"
          >
            {locale === "es"
              ? "Ver la guía: cómo cargar USDC paso a paso →"
              : "See the guide: how to load USDC step by step →"}
          </Link>
        </div>
      </Card>
    </div>
  );
}
