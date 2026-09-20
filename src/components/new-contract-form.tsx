"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiErrorMessage } from "@/lib/i18n";

import { useI18n } from "./i18n-provider";
import { Alert, Button, Card, Field, Input, Textarea } from "./ui";
import { ConnectWalletButton, useWallet } from "./wallet";

type LandlordPreview = {
  alias: string;
  name: string;
  lastName: string | null;
};

export function NewContractForm({ defaultWallet }: { defaultWallet: string }) {
  const router = useRouter();
  const { address } = useWallet();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [landlordAlias, setLandlordAlias] = useState("");
  const [landlord, setLandlord] = useState<LandlordPreview | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    setVerifying(true);
    setError(null);
    setLandlord(null);
    const response = await fetch(`/api/users/lookup?alias=${encodeURIComponent(landlordAlias)}`);
    const body = await response.json().catch(() => ({}));
    setVerifying(false);
    if (!response.ok) {
      setError(apiErrorMessage(t, body, t.newContract.error));
      return;
    }
    setLandlord(body.user);
  }

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
            placeholder={t.newContract.propertyLabelPlaceholder}
          />
        </Field>
        <Field label={t.newContract.propertyAddress}>
          <Input
            name="propertyAddress"
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
          <Input name="guaranteeAmount" required inputMode="decimal" placeholder="1000" />
        </Field>
        <Field label={t.newContract.rentAmount}>
          <Input name="rentAmount" inputMode="decimal" placeholder="850" />
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
      </form>
    </Card>
  );
}
