"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button } from "./ui";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/invites/${token}`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "Could not accept the invitation");
      return;
    }
    router.push(`/contracts/${body.contract.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Button onClick={accept} disabled={pending}>
        {pending ? "Accepting…" : "Accept contract"}
      </Button>
    </div>
  );
}
