"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiErrorMessage } from "@/lib/i18n";

import { HowItWorks } from "./how-it-works";
import { useI18n } from "./i18n-provider";
import { Alert, Button, Card, Field, Input, Textarea } from "./ui";
import { ConnectWalletButton, useWallet } from "./wallet";

type LandlordPreview = {
  alias: string;
  name: string;
  lastName: string | null;
};

type Prefill = {
  landlordAlias?: string;
  guaranteeAmount?: string;
  rentAmount?: string;
  propertyLabel?: string;
  propertyAddress?: string;
};

export function NewContractForm({
  defaultWallet,
  prefill,
}: {
  defaultWallet: string;
  prefill?: Prefill;
}) {
  const router = useRouter();
  const { address } = useWallet();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [landlordAlias, setLandlordAlias] = useState(
    prefill?.landlordAlias?.toLowerCase() ?? "",
  );
  const [landlord, setLandlord] = useState<LandlordPreview | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function verify(aliasToCheck = landlordAlias) {
    setVerifying(true);
    setError(null);
    setLandlord(null);
    const response = await fetch(
      `/api/users/lookup?alias=${encodeURIComponent(aliasToCheck)}`,
    );
    const body = await response.json().catch(() => ({}));
    setVerifying(false);
    if (!response.ok) {
      setError(apiErrorMessage(t, body, t.newContract.error));
      return;
    }
    setLandlord(body.user);
  }

  useEffect(() => {
    const initial = prefill?.landlordAlias?.trim().toLowerCase();
    if (!initial || initial.length < 3) return;
    let cancelled = false;
    (async () => {
      const response = await fetch(
        `/api/users/lookup?alias=${encodeURIComponent(initial)}`,
      );
      const body = await response.json().catch(() => ({}));
      if (!cancelled && response.ok) {
        setLandlord(body.user);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefill?.landlordAlias]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!landlord) {
      setError(apiErrorMessage(t, {}, t.errors.aliasNotFound));
      return;
    }
    setPending(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, landlordAlias: landlord.alias }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);

    if (!response.ok) {
      setError(apiErrorMessage(t, body, t.newContract.error));
      return;
    }
    router.push(`/contracts/${body.contract.id}`);
    router.refresh();
  }

  return (
    <Card
      title={t.newContract.title}
      description={t.newContract.description}
      actions={<ConnectWalletButton />}
    >
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Field label={t.newContract.landlordAlias} hint={t.newContract.landlordAliasHint}>
            <div className="flex gap-2">
              <Input
                value={landlordAlias}
                onChange={(event) => {
                  setLandlordAlias(event.target.value.toLowerCase());
                  setLandlord(null);
                }}
                placeholder={t.newContract.landlordAliasPlaceholder}
                required
              />
              <Button
                type="button"
                variant="secondary"
                disabled={verifying || landlordAlias.trim().length < 3}
                onClick={() => void verify()}
              >
                {verifying ? t.newContract.verifying : t.newContract.verify}
              </Button>
            </div>
          </Field>
          {landlord && (
            <Alert tone="info">
              {t.newContract.landlordFound} @{landlord.alias} —{" "}
              {[landlord.name, landlord.lastName].filter(Boolean).join(" ")}
            </Alert>
          )}
        </div>
        <Field label={t.newContract.propertyLabel}>
          <Input
            name="propertyLabel"
            defaultValue={prefill?.propertyLabel ?? ""}
            placeholder={t.newContract.propertyLabelPlaceholder}
          />
        </Field>
        <Field label={t.newContract.propertyAddress}>
          <Input
            name="propertyAddress"
            defaultValue={prefill?.propertyAddress ?? ""}
            placeholder={t.newContract.propertyAddressPlaceholder}
          />
        </Field>
        <Field label={t.newContract.guarantorWallet} hint={t.newContract.walletHint}>
          <Input
            name="guarantorWallet"
            required
            pattern="G[A-Z2-7]{55}"
            defaultValue={address ?? defaultWallet}
            placeholder="G..."
          />
        </Field>
        <Field label={t.newContract.guaranteeAmount}>
          <Input
            name="guaranteeAmount"
            required
            inputMode="decimal"
            defaultValue={prefill?.guaranteeAmount ?? ""}
            placeholder="1000"
          />
        </Field>
        <Field label={t.newContract.rentAmount}>
          <Input
            name="rentAmount"
            inputMode="decimal"
            defaultValue={prefill?.rentAmount ?? ""}
            placeholder="850"
          />
        </Field>
        <Field label={t.newContract.startDate}>
          <Input name="startDate" type="date" required />
        </Field>
        <Field label={t.newContract.endDate}>
          <Input name="endDate" type="date" required />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t.newContract.notes}>
            <Textarea name="notes" rows={3} />
          </Field>
        </div>
        {error && (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending || !landlord}>
            {pending ? t.newContract.submitting : t.newContract.submit}
          </Button>
        </div>
        <div className="sm:col-span-2">
          <HowItWorks label={t.newContract.howItWorks} body={t.newContract.howItWorksBody} />
        </div>
      </form>
    </Card>
  );
}
