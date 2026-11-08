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
    <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 font-semibold text-fg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <span className="text-base font-bold tracking-tight">{t.nav.brand}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {isChainConfigured() ? t.nav.chainTestnet : t.nav.chainDemo}
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <NavLink href="/dashboard">{t.nav.dashboard}</NavLink>
              <NavLink href="/contracts/new">{t.nav.newGuarantee}</NavLink>
              <Link
                href="/notifications"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-muted hover:text-fg"
              >
                {t.nav.notifications}
                {unread > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-fg">
                    {unread}
                  </span>
                )}
              </Link>
              <NavLink href="/profile">{t.nav.profile}</NavLink>
              <NavLink href="/faq">{t.nav.faq}</NavLink>
              <Link
                href="/profile"
                className="rounded-full border border-line bg-surface-muted px-3 py-1 font-mono text-xs font-medium text-fg transition hover:border-accent/60"
              >
                @{user.alias ?? user.name}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <NavLink href="/faq">{t.nav.faq}</NavLink>
              <NavLink href="/login">{t.nav.signIn}</NavLink>
              <Link
                href="/register"
                className="rounded-card bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-fg shadow-sm shadow-accent/20 transition hover:brightness-110"
              >
                {t.nav.signUp}
              </Link>
            </>
          )}
          <Preferences theme={theme} />
        </nav>
      </div>
    </header>
  );
}
