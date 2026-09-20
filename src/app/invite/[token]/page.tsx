import Link from "next/link";
import { redirect } from "next/navigation";

import { AcceptInvite } from "@/components/accept-invite";
import { Card, Row } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatUsdc } from "@/lib/money";
import { findContractByInvite } from "@/lib/services/contracts";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  const [row, locale] = await Promise.all([
    findContractByInvite(token),
    getLocale(),
  ]);
  const t = getDictionary(locale);
  if (!row) {
    return (
      <Card title={t.invite.unavailableTitle}>
        <p className="text-sm text-muted">
          {t.invite.unavailableBody}{" "}
          <Link href="/dashboard" className="underline">
            {t.invite.goToContracts}
          </Link>
          .
        </p>
      </Card>
    );
  }

  const { contract, property } = row;

  return (
    <div className="mx-auto max-w-xl">
      <Card
        title={t.invite.confirmTitle}
        description={t.invite.confirmDescription}
      >
        <dl className="mb-4">
          <Row label={t.invite.property} value={property.label} />
          <Row label={t.invite.address} value={property.address} />
          <Row
            label={t.invite.guarantee}
            value={formatUsdc(contract.guaranteeAmount)}
          />
          <Row label={t.invite.reference} value={contract.reference} />
        </dl>
        <AcceptInvite token={token} />
      </Card>
    </div>
  );
}
