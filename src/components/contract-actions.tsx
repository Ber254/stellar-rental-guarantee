"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ContractStatus, PartyRole } from "@/lib/db/schema";
import { apiErrorMessage, interpolate } from "@/lib/i18n";
import type { ChainStep } from "@/lib/services/chain";
import { useI18n } from "./i18n-provider";
import { Alert, Button, Card, Field, Input } from "./ui";
import { ConnectWalletButton, useWallet } from "./wallet";

type PendingProposal = {
  id: string;
  toGuarantor: string;
  toLandlord: string;
  mine: boolean;
};

type PendingExtension = {
  proposedNewAmount: string;
  proposedNewEndDate: string;
};

type EditableDefaults = {
  guaranteeAmount: string;
  rentAmount: string;
  startDate: string;
  endDate: string;
  notes: string;
};

export function ContractActions({
  contractId,
  role,
  status,
  landlordName,
  locked,
  escrowRegistered,
  pendingProposal,
  pendingExtension,
  editableDefaults,
}: {
  contractId: string;
  role: PartyRole;
  status: ContractStatus;
  landlordName: string;
  locked: string;
  escrowRegistered: boolean;
  pendingProposal: PendingProposal | null;
  pendingExtension: PendingExtension | null;
  editableDefaults: EditableDefaults;
}) {
  const router = useRouter();
  const { sign } = useWallet();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toGuarantor, setToGuarantor] = useState("");
  const [returnAmount, setReturnAmount] = useState("");
  const [unilateralAmount, setUnilateralAmount] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [settlementRejectReason, setSettlementRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [extendAmount, setExtendAmount] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(editableDefaults);

  async function run(step: ChainStep, extra: Record<string, unknown> = {}) {
    setBusy(step);
    setError(null);
    try {
      const body: Record<string, unknown> = { step, ...extra };
      let response = await fetch(`/api/contracts/${contractId}/chain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      let result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(t, result, t.actions.failed));

      if (result.mode === "sign") {
        const signedXdr = await sign(result.xdr);
        response = await fetch(`/api/contracts/${contractId}/chain`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, signedXdr }),
        });
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(apiErrorMessage(t, result, t.actions.failed));
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.actions.failed);
    } finally {
      setBusy(null);
    }
  }

  async function respondToInvitation(accept: boolean) {
    setBusy(accept ? "accept-invite" : "reject-invite");
    setError(null);
    const response = await fetch(
      `/api/contracts/${contractId}/${accept ? "accept" : "reject"}`,
      {
        method: "POST",
        headers: accept ? undefined : { "content-type": "application/json" },
        body: accept ? undefined : JSON.stringify({ reason: rejectReason }),
      },
    );
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(apiErrorMessage(t, result, t.actions.failed));
      return;
    }
    router.refresh();
  }

  async function cancelPending() {
    setBusy("cancel-pending");
    setError(null);
    const response = await fetch(`/api/contracts/${contractId}/cancel`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(apiErrorMessage(t, result, t.actions.failed));
      return;
    }
    router.refresh();
  }

  async function saveEdit() {
    setBusy("save-edit");
    setError(null);
    const response = await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(edit),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(apiErrorMessage(t, result, t.actions.failed));
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const total = Number(locked);
  const guarantorShare = toGuarantor === "" ? null : Number(toGuarantor);
  const landlordShare =
    guarantorShare === null || Number.isNaN(guarantorShare)
      ? null
      : Math.round((total - guarantorShare) * 1e7) / 1e7;
  const shareValid =
    landlordShare !== null && landlordShare >= 0 && guarantorShare !== null && guarantorShare >= 0;

  const inNegotiation = status === "RETURN_REQUESTED" || status === "NEGOTIATION";
  const isActive = status === "ACTIVE" || status === "EXPIRED";

  return (
    <Card title={t.actions.title} actions={<ConnectWalletButton />}>
      <div className="space-y-5">
        {status === "PENDING_ACCEPTANCE" && role === "LANDLORD" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button disabled={busy !== null} onClick={() => respondToInvitation(true)}>
                {busy === "accept-invite" ? t.actions.accepting : t.actions.accept}
              </Button>
              <Button
                variant="danger"
                disabled={busy !== null}
                onClick={() => setShowReject((value) => !value)}
              >
                {t.actions.reject}
              </Button>
            </div>
            {showReject && (
              <div className="space-y-2">
                <Field label={t.actions.rejectReasonLabel}>
                  <Input
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder={t.actions.rejectReasonPlaceholder}
                  />
                </Field>
                <Button
                  variant="danger"
                  disabled={busy !== null || rejectReason.trim() === ""}
                  onClick={() => respondToInvitation(false)}
                >
                  {busy === "reject-invite" ? t.actions.rejecting : t.actions.reject}
                </Button>
              </div>
            )}
          </div>
        )}

        {status === "PENDING_ACCEPTANCE" && role === "GUARANTOR" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {interpolate(t.actions.waitingLandlord, { landlord: landlordName })}
            </p>

            {!editing ? (
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" disabled={busy !== null} onClick={() => setEditing(true)}>
                  {t.actions.edit}
                </Button>
                <Button variant="danger" disabled={busy !== null} onClick={() => cancelPending()}>
                  {busy === "cancel-pending" ? t.actions.cancelling : t.actions.cancel}
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.newContract.guaranteeAmount}>
                  <Input
                    inputMode="decimal"
                    value={edit.guaranteeAmount}
                    onChange={(event) => setEdit({ ...edit, guaranteeAmount: event.target.value })}
                  />
                </Field>
                <Field label={t.newContract.rentAmount}>
                  <Input
                    inputMode="decimal"
                    value={edit.rentAmount}
                    onChange={(event) => setEdit({ ...edit, rentAmount: event.target.value })}
                  />
                </Field>
                <Field label={t.newContract.startDate}>
                  <Input
                    type="date"
                    value={edit.startDate}
                    onChange={(event) => setEdit({ ...edit, startDate: event.target.value })}
                  />
                </Field>
                <Field label={t.newContract.endDate}>
                  <Input
                    type="date"
                    value={edit.endDate}
                    onChange={(event) => setEdit({ ...edit, endDate: event.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t.newContract.notes}>
                    <Input
                      value={edit.notes}
                      onChange={(event) => setEdit({ ...edit, notes: event.target.value })}
                    />
                  </Field>
                </div>
                <div className="flex gap-3 sm:col-span-2">
                  <Button disabled={busy !== null} onClick={() => saveEdit()}>
                    {busy === "save-edit" ? t.actions.sending : t.profile.save}
                  </Button>
                  <Button variant="secondary" disabled={busy !== null} onClick={() => setEditing(false)}>
                    {t.profile.cancel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {status === "AWAITING_FUNDING" && role === "GUARANTOR" && (
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy !== null || escrowRegistered}
              onClick={() => run("create")}
            >
              {escrowRegistered ? t.actions.escrowRegistered : t.actions.registerEscrow}
            </Button>
            <Button disabled={busy !== null} onClick={() => run("fund")}>
              {busy === "fund" ? t.actions.locking : t.actions.fund}
            </Button>
            <Button variant="danger" disabled={busy !== null} onClick={() => run("cancel")}>
              {busy === "cancel" ? t.actions.cancelling : t.actions.cancel}
            </Button>
          </div>
        )}

        {status === "AWAITING_FUNDING" && role === "LANDLORD" && (
          <p className="text-sm text-muted">{t.actions.waitingGuarantorFunding}</p>
        )}

        {isActive && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {interpolate(t.actions.lockedAmount, { amount: locked })}
            </p>
            {status === "EXPIRED" && <Alert tone="warning">{t.actions.expired}</Alert>}

            {role === "GUARANTOR" && (
              <div className="space-y-2 rounded-card border border-line p-4">
                <p className="text-sm font-medium text-fg">{t.actions.requestReturnTitle}</p>
                <p className="text-xs text-muted">{t.actions.requestReturnHint}</p>
                <Field label={t.actions.requestReturnAmount}>
                  <Input
                    inputMode="decimal"
                    value={returnAmount}
                    onChange={(event) => setReturnAmount(event.target.value)}
                    placeholder={locked}
                  />
                </Field>
                <Button
                  disabled={busy !== null || !returnAmount}
                  onClick={() =>
                    run("propose", {
                      propose: { toGuarantor: returnAmount, toLandlord: "0" },
                    })
                  }
                >
                  {busy === "propose" ? t.actions.sending : t.actions.requestReturnSubmit}
                </Button>
              </div>
            )}

            {role === "LANDLORD" && (
              <div className="space-y-2 rounded-card border border-line p-4">
                <p className="text-sm font-medium text-fg">{t.actions.returnUnilateralTitle}</p>
                <p className="text-xs text-muted">{t.actions.returnUnilateralHint}</p>
                <Field label={t.actions.requestReturnAmount}>
                  <Input
                    inputMode="decimal"
                    value={unilateralAmount}
                    onChange={(event) => setUnilateralAmount(event.target.value)}
                    placeholder={locked}
                  />
                </Field>
                <Button
                  disabled={busy !== null || !unilateralAmount}
                  onClick={() =>
                    run("return-unilateral", { returnUnilateral: { amount: unilateralAmount } })
                  }
                >
                  {busy === "return-unilateral"
                    ? t.actions.sending
                    : t.actions.returnUnilateralSubmit}
                </Button>
              </div>
            )}

            {role === "GUARANTOR" && !pendingExtension && (
              <div className="space-y-2 rounded-card border border-line p-4">
                <p className="text-sm font-medium text-fg">{t.actions.extendTitle}</p>
                <p className="text-xs text-muted">{t.actions.extendHint}</p>
                <Field label={t.actions.extendNewAmount}>
                  <Input
                    inputMode="decimal"
                    value={extendAmount}
                    onChange={(event) => setExtendAmount(event.target.value)}
                  />
                </Field>
                <Field label={t.actions.extendNewEndDate}>
                  <Input
                    type="date"
                    value={extendDate}
                    onChange={(event) => setExtendDate(event.target.value)}
                  />
                </Field>
                <Button
                  disabled={busy !== null || !extendAmount || !extendDate}
                  onClick={() =>
                    run("extend-propose", {
                      extension: { newAmount: extendAmount, newEndDate: extendDate },
                    })
                  }
                >
                  {busy === "extend-propose" ? t.actions.sending : t.actions.extendSubmit}
                </Button>
              </div>
            )}
          </div>
        )}

        {pendingExtension && (
          <div className="space-y-2 rounded-card border border-line bg-surface-muted p-4">
            <p className="text-sm text-fg">
              {interpolate(t.actions.extendPending, {
                amount: pendingExtension.proposedNewAmount,
                date: pendingExtension.proposedNewEndDate.slice(0, 10),
              })}
            </p>
            <div className="flex gap-3">
              {role === "LANDLORD" && (
                <Button disabled={busy !== null} onClick={() => run("extend-accept")}>
                  {busy === "extend-accept" ? t.actions.sending : t.actions.extendAccept}
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run("extend-cancel")}
              >
                {busy === "extend-cancel" ? t.actions.sending : t.actions.extendCancel}
              </Button>
            </div>
          </div>
        )}

        {inNegotiation && (
          <div className="space-y-4">
            {pendingProposal && (
              <div className="rounded-card border border-line bg-surface-muted p-4 text-sm">
                <p className="font-medium text-fg">
                  {interpolate(t.actions.openProposal, {
                    guarantor: pendingProposal.toGuarantor,
                    landlord: pendingProposal.toLandlord,
                  })}
                </p>
                {pendingProposal.mine ? (
                  <p className="mt-1 text-muted">{t.actions.waitingOther}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Button disabled={busy !== null} onClick={() => run("accept")}>
                      {busy === "accept" ? t.actions.accepting : t.actions.accept}
                    </Button>
                    <Field label={t.actions.rejectReasonLabel}>
                      <Input
                        value={settlementRejectReason}
                        onChange={(event) => setSettlementRejectReason(event.target.value)}
                        placeholder={t.actions.rejectReasonPlaceholder}
                      />
                    </Field>
                    <Button
                      variant="danger"
                      disabled={busy !== null || settlementRejectReason.trim() === ""}
                      onClick={() => run("reject", { propose: { reason: settlementRejectReason } })}
                    >
                      {busy === "reject" ? t.actions.rejecting : t.actions.reject}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Field label={t.actions.counterOffer} hint={t.actions.requestReturnHint}>
                <Input
                  inputMode="decimal"
                  placeholder={t.actions.counterOfferGuarantor}
                  value={toGuarantor}
                  onChange={(event) => setToGuarantor(event.target.value)}
                />
              </Field>
              <p className="text-sm text-muted">
                {t.actions.counterOfferLandlord}:{" "}
                {shareValid && landlordShare !== null ? landlordShare : "—"}
              </p>
              <Button
                disabled={busy !== null || !shareValid}
                onClick={() =>
                  run("propose", {
                    propose: { toGuarantor: String(guarantorShare), toLandlord: String(landlordShare) },
                  })
                }
              >
                {busy === "propose" ? t.actions.sending : t.actions.sendCounter}
              </Button>
            </div>
          </div>
        )}

        {status === "AGREED" && (
          <div className="space-y-3">
            <Button disabled={busy !== null} onClick={() => run("execute")}>
              {busy === "execute" ? t.actions.executing : t.actions.execute}
            </Button>
          </div>
        )}

        {(status === "COMPLETED" || status === "RELEASED") && (
          <p className="text-sm text-muted">{t.actions.done}</p>
        )}

        {status === "REJECTED" && (
          <p className="text-sm text-muted">{t.status.REJECTED}</p>
        )}
        {status === "CANCELLED" && (
          <p className="text-sm text-muted">{t.status.CANCELLED}</p>
        )}

        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Card>
  );
}
