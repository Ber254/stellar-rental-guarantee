import Link from "next/link";
import { redirect } from "next/navigation";

import { AcceptInvite } from "@/components/accept-invite";
import { Card, Row } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
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

  const row = await findContractByInvite(token);
  if (!row) {
    return (
      <Card title="Invitation not available">
        <p className="text-sm text-slate-600">
          This invitation does not exist or was already accepted.{" "}
          <Link href="/dashboard" className="underline">
            Go to your contracts
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
        title="Confirm the rental contract"
        description="As landlord you confirm the terms. The deposit stays locked in the escrow until both of you agree on how to split it."
      >
        <dl className="mb-4">
          <Row label="Property" value={property.label} />
          <Row label="Address" value={property.address} />
          <Row label="Guarantee" value={formatUsdc(contract.guaranteeAmount)} />
          <Row label="Reference" value={contract.reference} />
        </dl>
        <AcceptInvite token={token} />
      </Card>
    </div>
  );
}
