"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useI18n } from "./i18n-provider";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm font-medium text-muted hover:text-fg"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        startTransition(() => {
          router.replace("/login");
          router.refresh();
        });
      }}
    >
      {t.nav.signOut}
    </button>
  );
}
