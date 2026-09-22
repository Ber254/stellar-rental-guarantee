import { and, count, eq, isNull } from "drizzle-orm";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { isChainConfigured } from "@/lib/env";
import { getDictionary, type Theme } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { LogoutButton } from "./logout-button";
import { Preferences } from "./preferences";
import { NavLink } from "./ui";

export async function SiteHeader({ theme }: { theme: Theme }) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = getDictionary(locale);
  const unread = user
    ? (
        await db
          .select({ value: count() })
          .from(notifications)
          .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
      )[0]?.value ?? 0
    : 0;

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href={user ? "/dashboard" : "/"} className="font-semibold text-fg">
          {t.nav.brand}
          <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent-fg">
            {isChainConfigured() ? t.nav.chainTestnet : t.nav.chainDemo}
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <NavLink href="/dashboard">{t.nav.dashboard}</NavLink>
              <NavLink href="/contracts/new">{t.nav.newGuarantee}</NavLink>
              <Link href="/notifications" className="text-sm font-medium text-muted hover:text-fg">
                {t.nav.notifications}
                {unread > 0 && (
                  <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-fg">
                    {unread}
                  </span>
                )}
              </Link>
              <NavLink href="/profile">{t.nav.profile}</NavLink>
              <NavLink href="/faq">{t.nav.faq}</NavLink>
              <span className="text-sm text-muted">@{user.alias ?? user.name}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <NavLink href="/faq">{t.nav.faq}</NavLink>
              <NavLink href="/login">{t.nav.signIn}</NavLink>
              <NavLink href="/register">{t.nav.signUp}</NavLink>
            </>
          )}
          <Preferences theme={theme} />
        </nav>
      </div>
    </header>
  );
}
