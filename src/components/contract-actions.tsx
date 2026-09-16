"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ContractStatus, PartyRole } from "@/lib/db/schema";
import type { ChainStep } from "@/lib/services/chain";
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
      if (!response.ok) throw new Error(result.error ?? "The operation failed");

      if (result.mode === "sign") {
        const signedXdr = await sign(result.xdr);
        response = await fetch(`/api/contracts/${contractId}/chain`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, signedXdr }),
        });
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "The operation failed");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operation failed");
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
      setError(result.error ?? "Could not reject the proposal");
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
    <Card title="Next step" actions={<ConnectWalletButton />}>
      <div className="space-y-4">
        {status === "PENDING_ACCEPTANCE" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              {role === "TENANT"
                ? "Send this link to your landlord so they can confirm the contract."
                : "Waiting for the contract to be confirmed."}
            </p>
            {inviteUrl && (
              <code className="block overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 text-xs">
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
              {escrowRegistered ? "Escrow registered" : "1. Register escrow"}
            </Button>
            <Button disabled={busy !== null} onClick={() => run("fund")}>
              {busy === "fund" ? "Locking…" : "2. Fund and lock deposit"}
            </Button>
          </div>
        )}

        {status === "AWAITING_FUNDING" && role === "LANDLORD" && (
          <p className="text-sm text-slate-600">
            Waiting for the tenant to lock the guarantee.
          </p>
        )}

        {status === "ACTIVE" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              The guarantee is locked. Neither party can withdraw it alone.
            </p>
            {role === "TENANT" && (
              <Button disabled={busy !== null} onClick={() => run("request-release")}>
                {busy === "request-release" ? "Sending…" : "Request the deposit back"}
              </Button>
            )}
          </div>
        )}

        {negotiating && (
          <div className="space-y-4">
            {pendingProposal && (
              <div className="rounded-lg bg-slate-50 p-4 text-sm">
                <p className="font-medium text-slate-900">
                  Open proposal: {pendingProposal.toLandlord} USDC to the landlord,{" "}
                  {pendingProposal.toTenant} USDC to the tenant.
                </p>
                {pendingProposal.mine ? (
                  <p className="mt-1 text-slate-600">Waiting for the other party.</p>
                ) : (
                  <div className="mt-3 flex gap-3">
                    <Button disabled={busy !== null} onClick={() => run("accept")}>
                      {busy === "accept" ? "Accepting…" : "Accept"}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy !== null}
                      onClick={() => reject()}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Field
                label={pendingProposal && !pendingProposal.mine ? "Counter offer" : "Propose a split"}
                hint={`The two amounts must add up to ${amount} USDC.`}
              >
                <Input
                  inputMode="decimal"
                  placeholder="To the landlord"
                  value={toLandlord}
                  onChange={(event) => setToLandlord(event.target.value)}
                />
              </Field>
              <p className="text-sm text-slate-600">
                To the tenant: {shareValid ? tenantShare : "—"} USDC
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
                {busy === "propose" ? "Sending…" : "Send proposal"}
              </Button>
            </div>
          </div>
        )}

        {status === "AGREED" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Both parties agreed. Releasing pays each wallet exactly the agreed
              amount.
            </p>
            <Button disabled={busy !== null} onClick={() => run("release")}>
              {busy === "release" ? "Releasing…" : "Release funds"}
            </Button>
          </div>
        )}

        {(status === "RELEASED" || status === "COMPLETED") && (
          <p className="text-sm text-slate-600">
            The guarantee was distributed. Nothing else to do.
          </p>
        )}

        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Card>
  );
}
