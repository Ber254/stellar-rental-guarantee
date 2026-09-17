"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "./i18n-provider";
import { Alert, Button, Card, Field, Input, Textarea } from "./ui";
import { ConnectWalletButton, useWallet } from "./wallet";

export function NewContractForm({ defaultWallet }: { defaultWallet: string }) {
  const router = useRouter();
  const { address } = useWallet();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);

    if (!response.ok) {
      setError(body.error ?? t.newContract.error);
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
        <Field label={t.newContract.propertyLabel}>
          <Input
            name="propertyLabel"
            required
            placeholder={t.newContract.propertyLabelPlaceholder}
          />
        </Field>
        <Field label={t.newContract.propertyAddress}>
          <Input
            name="propertyAddress"
            required
            placeholder={t.newContract.propertyAddressPlaceholder}
          />
        </Field>
        <Field label={t.newContract.landlordName}>
          <Input name="landlordName" required />
        </Field>
        <Field label={t.newContract.landlordEmail}>
          <Input name="landlordEmail" type="email" />
        </Field>
        <Field label={t.newContract.tenantWallet} hint={t.newContract.walletHint}>
          <Input
            name="tenantWallet"
            required
            pattern="G[A-Z2-7]{55}"
            defaultValue={address ?? defaultWallet}
            placeholder="G..."
          />
        </Field>
        <Field label={t.newContract.landlordWallet}>
          <Input name="landlordWallet" required pattern="G[A-Z2-7]{55}" placeholder="G..." />
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
          <Button type="submit" disabled={pending}>
            {pending ? t.newContract.submitting : t.newContract.submit}
          </Button>
        </div>
      </form>
    </Card>
  );
}
