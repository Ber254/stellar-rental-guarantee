"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Card, Field, Input } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setPending(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <Card
        title={isRegister ? "Create your account" : "Sign in"}
        description={
          isRegister
            ? "You will use this account as tenant or as landlord."
            : "Welcome back."
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {isRegister && (
            <Field label="Full name">
              <Input name="name" required minLength={2} autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input
              name="password"
              type="password"
              required
              minLength={isRegister ? 8 : 1}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </Field>
          {isRegister && (
            <Field
              label="Stellar address (optional)"
              hint="You can also connect a wallet later."
            >
              <Input name="stellarAddress" placeholder="G..." />
            </Field>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          {isRegister ? (
            <>
              Already have an account? <Link href="/login" className="underline">Sign in</Link>
            </>
          ) : (
            <>
              No account yet?{" "}
              <Link href="/register" className="underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
