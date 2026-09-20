"use client";

import { useEffect, useState } from "react";

import { useI18n } from "./i18n-provider";
import { Alert, Button, Field, Input } from "./ui";

export function ProfileAlias({ alias }: { alias: string | null }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(alias ?? "");
  const [check, setCheck] = useState<{ alias: string; available: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const skip = !editing || value.trim().length < 3 || value === alias;
  const status: "idle" | "checking" | "available" | "unavailable" = skip
    ? "idle"
    : check?.alias !== value
      ? "checking"
      : check.available
        ? "available"
        : "unavailable";

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const response = await fetch(`/api/users/alias?alias=${encodeURIComponent(value)}`);
      const body = await response.json().catch(() => ({}));
      if (!cancelled) setCheck({ alias: value, available: Boolean(body.available) });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [value, skip]);

  async function save() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/users/alias", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias: value }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? t.actions.failed);
      return;
    }
    setEditing(false);
    window.location.reload();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-fg">@{alias ?? "—"}</span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            navigator.clipboard?.writeText(`@${alias ?? ""}`).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t.profile.copied : t.profile.copyAlias}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          {t.profile.editAlias}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Field
        label={t.profile.aliasLabel}
        hint={
          status === "checking"
            ? t.profile.aliasChecking
            : status === "available"
              ? t.profile.aliasAvailable
              : status === "unavailable"
                ? t.profile.aliasUnavailable
                : undefined
        }
      >
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value.toLowerCase())}
          minLength={3}
          maxLength={30}
        />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={saving || status === "unavailable" || value.trim().length < 3}
          onClick={() => void save()}
        >
          {t.profile.save}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          {t.profile.cancel}
        </Button>
      </div>
    </div>
  );
}
