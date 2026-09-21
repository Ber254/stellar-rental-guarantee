import { redirect } from "next/navigation";

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
          <p className="text-lg font-semibold text-fg">
            {formatUsdc(fromStroops(available < 0n ? 0n : available))}
          </p>
        </Card>
      ) : (
        <Card title={t.profile.availableBalance} description={t.profile.balanceHint}>
          <p className="text-lg font-semibold text-fg">{formatUsdc(fromStroops(committed))}</p>
        </Card>
      )}
    </div>
  );
}
