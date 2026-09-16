"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Card, Field, Input, Textarea } from "./ui";
import { ConnectWalletButton, useWallet } from "./wallet";

export function NewContractForm({ defaultWallet }: { defaultWallet: string }) {
  const router = useRouter();
  const { address } = useWallet();
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
      setError(body.error ?? "Could not create the contract");
      return;
    }
    router.push(`/contracts/${body.contract.id}`);
    router.refresh();
  }

  return (
    <Card
      title="New rental contract"
      description="You are the tenant. The landlord confirms through an invitation link."
      actions={<ConnectWalletButton />}
    >
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Property name">
          <Input name="propertyLabel" required placeholder="Apartment 4B" />
        </Field>
        <Field label="Address">
          <Input name="propertyAddress" required placeholder="Calle Mayor 10, Madrid" />
        </Field>
        <Field label="Landlord name">
          <Input name="landlordName" required />
        </Field>
        <Field label="Landlord email (optional)">
          <Input name="landlordEmail" type="email" />
        </Field>
        <Field label="Your wallet (tenant)" hint="Stellar public key, starts with G">
          <Input
            name="tenantWallet"
            required
            pattern="G[A-Z2-7]{55}"
            defaultValue={address ?? defaultWallet}
            placeholder="G..."
          />
        </Field>
        <Field label="Landlord wallet">
          <Input name="landlordWallet" required pattern="G[A-Z2-7]{55}" placeholder="G..." />
        </Field>
        <Field label="Guarantee amount (USDC)">
          <Input name="guaranteeAmount" required inputMode="decimal" placeholder="1000" />
        </Field>
        <Field label="Monthly rent (optional)">
          <Input name="rentAmount" inputMode="decimal" placeholder="850" />
        </Field>
        <Field label="Start date">
          <Input name="startDate" type="date" required />
        </Field>
        <Field label="End date">
          <Input name="endDate" type="date" required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes (optional)">
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
            {pending ? "Creating…" : "Create contract"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
