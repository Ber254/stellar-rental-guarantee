"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm font-medium text-slate-600 hover:text-slate-900"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        startTransition(() => {
          router.replace("/login");
          router.refresh();
        });
      }}
    >
      Sign out
    </button>
  );
}
