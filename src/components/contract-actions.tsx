"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ContractStatus, PartyRole } from "@/lib/db/schema";
import { interpolate } from "@/lib/i18n";
import type { ChainStep } from "@/lib/services/chain";
import { useI18n } from "./i18n-provider";
import { Alert, Button, Card, Field, Input } from "./ui";
import { ConnectWalletButton, useWallet } from "./wallet";

type PendingProposal = {
  id: string;
  toLandlord: string;
  toTenant: string;
  mine: boolean;
};

export function ContractActions({
  contractId,
  role,
  status,
  amount,
  escrowRegistered,
  pendingProposal,
  inviteUrl,
}: {
  contractId: string;
  role: PartyRole;
  status: ContractStatus;
  amount: string;
  escrowRegistered: boolean;
  pendingProposal: PendingProposal | null;
  inviteUrl: string | null;
}) {
  const router = useRouter();
  const { sign } = useWallet();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toLandlord, setToLandlord] = useState("");

  async function run(step: ChainStep, propose?: { toLandlord: string; toTenant: string }) {
    setBusy(step);
    setError(null);
    try {
      const body: Record<string, unknown> = { step, propose };
      let response = await fetch(`/api/contracts/${contractId}/chain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      let result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? t.actions.failed);

      if (result.mode === "sign") {
        const signedXdr = await sign(result.xdr);
        response = await fetch(`/api/contracts/${contractId}/chain`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, signedXdr }),
        });
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? t.actions.failed);
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.actions.failed);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    const response = await fetch(`/api/contracts/${contractId}/reject`, {
      method: "POST",
    });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? t.actions.rejectFailed);
      return;
    }
    router.refresh();
  }

  const total = Number(amount);
  const landlordShare = toLandlord === "" ? null : Number(toLandlord);
  const tenantShare =
    landlordShare === null || Number.isNaN(landlordShare)
      ? null
      : Math.round((total - landlordShare) * 1e7) / 1e7;
  const shareValid =
    tenantShare !== null && tenantShare >= 0 && landlordShare !== null && landlordShare >= 0;

  const negotiating = status === "RETURN_REQUESTED" || status === "NEGOTIATION";

  return (
    <Card title={t.actions.title} actions={<ConnectWalletButton />}>
      <div className="space-y-4">
        {status === "PENDING_ACCEPTANCE" && (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              {role === "TENANT"
                ? t.actions.inviteTenant
                : t.actions.inviteLandlord}
            </p>
            {inviteUrl && (
              <code className="block overflow-x-auto rounded-card bg-surface-muted px-3 py-2 text-xs text-fg">
                {inviteUrl}
              </code>
            )}
          </div>
        )}

        {status === "AWAITING_FUNDING" && role === "TENANT" && (
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy !== null || escrowRegistered}
              onClick={() => run("create")}
            >
              {escrowRegistered
                ? t.actions.escrowRegistered
                : t.actions.registerEscrow}
            </Button>
            <Button disabled={busy !== null} onClick={() => run("fund")}>
              {busy === "fund" ? t.actions.locking : t.actions.fund}
            </Button>
          </div>
        )}

        {status === "AWAITING_FUNDING" && role === "LANDLORD" && (
          <p className="text-sm text-muted">{t.actions.waitingTenant}</p>
        )}

        {status === "ACTIVE" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t.actions.locked}</p>
            {role === "TENANT" && (
              <Button disabled={busy !== null} onClick={() => run("request-release")}>
                {busy === "request-release"
                  ? t.actions.sending
                  : t.actions.requestReturn}
              </Button>
            )}
          </div>
        )}

        {negotiating && (
          <div className="space-y-4">
            {pendingProposal && (
              <div className="rounded-card border border-line bg-surface-muted p-4 text-sm">
                <p className="font-medium text-fg">
                  {interpolate(t.actions.openProposal, {
                    landlord: pendingProposal.toLandlord,
                    tenant: pendingProposal.toTenant,
                  })}
                </p>
                {pendingProposal.mine ? (
                  <p className="mt-1 text-muted">{t.actions.waitingOther}</p>
                ) : (
                  <div className="mt-3 flex gap-3">
                    <Button disabled={busy !== null} onClick={() => run("accept")}>
                      {busy === "accept" ? t.actions.accepting : t.actions.accept}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy !== null}
                      onClick={() => reject()}
                    >
                      {t.actions.reject}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Field
                label={
                  pendingProposal && !pendingProposal.mine
                    ? t.actions.counterOffer
                    : t.actions.proposeSplit
                }
                hint={interpolate(t.actions.splitHint, { amount })}
              >
                <Input
                  inputMode="decimal"
                  placeholder={t.actions.toLandlordPlaceholder}
                  value={toLandlord}
                  onChange={(event) => setToLandlord(event.target.value)}
                />
              </Field>
              <p className="text-sm text-muted">
                {interpolate(t.actions.toTenant, {
                  amount: shareValid && tenantShare !== null ? tenantShare : "—",
                })}
              </p>
              <Button
                disabled={busy !== null || !shareValid}
                onClick={() =>
                  run("propose", {
                    toLandlord: String(landlordShare),
                    toTenant: String(tenantShare),
                  })
                }
              >
                {busy === "propose" ? t.actions.sending : t.actions.sendProposal}
              </Button>
            </div>
          </div>
        )}

        {status === "AGREED" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t.actions.agreed}</p>
            <Button disabled={busy !== null} onClick={() => run("release")}>
              {busy === "release" ? t.actions.releasing : t.actions.release}
            </Button>
          </div>
        )}

        {(status === "RELEASED" || status === "COMPLETED") && (
          <p className="text-sm text-muted">{t.actions.done}</p>
        )}

        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Card>
  );
}
