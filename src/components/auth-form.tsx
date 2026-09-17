"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "./i18n-provider";
import { Alert, Button, Card, Field, Input } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { t } = useI18n();
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
      setError(body.error ?? t.auth.genericError);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <Card
        title={isRegister ? t.auth.createTitle : t.auth.signInTitle}
        description={
          isRegister ? t.auth.createDescription : t.auth.signInDescription
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {isRegister && (
            <Field label={t.auth.name}>
              <Input name="name" required minLength={2} autoComplete="name" />
            </Field>
          )}
          <Field label={t.auth.email}>
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label={t.auth.password}>
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
              label={t.auth.stellarAddress}
              hint={t.auth.stellarAddressHint}
            >
              <Input name="stellarAddress" placeholder="G..." />
            </Field>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? t.auth.wait
              : isRegister
                ? t.nav.signUp
                : t.nav.signIn}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          {isRegister ? (
            <>
              {t.auth.haveAccount}{" "}
              <Link href="/login" className="underline">
                {t.nav.signIn}
              </Link>
            </>
          ) : (
            <>
              {t.auth.noAccount}{" "}
              <Link href="/register" className="underline">
                {t.auth.createOne}
              </Link>
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
