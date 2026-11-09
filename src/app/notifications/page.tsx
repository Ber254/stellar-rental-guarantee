import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";

import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications, type Notification } from "@/lib/db/schema";
import { getDictionary, interpolate, type Dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

/**
 * Renders from `kind` + `data` against the dictionary, so a notification
 * shows in whatever language the viewer reads the app in today — never the
 * language it happened to be written in. Rows from before this model
 * (no `data`) fall back to their stored, English-only text.
 */
function renderNotification(t: Dictionary, row: Notification) {
  if (row.data) {
    return {
      title: t.notifications.titles[row.kind],
      body: interpolate(t.notifications.bodies[row.kind], row.data),
    };
  }
  return { title: row.title ?? t.notifications.titles[row.kind], body: row.body };
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [rows, locale] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50),
    getLocale(),
  ]);

  if (rows.some((row) => !row.readAt)) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
      );
  }

  const t = getDictionary(locale);
  const isEs = locale === "es";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-fg">{t.nav.notifications}</h1>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t.notifications.empty}</p>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const { title, body } = renderNotification(t, row);
            const isUnread = !row.readAt;
            return (
              <li key={row.id}>
                <Link
                  href={row.contractId ? `/contracts/${row.contractId}` : "#"}
                  className={`block rounded-card border p-4 transition hover:border-accent ${
                    isUnread
                      ? "border-accent/50 bg-surface-muted/80"
                      : "border-line bg-surface/90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-fg">{title}</p>
                    {isUnread && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-fg">
                        {isEs ? "Nueva" : "New"}
                      </span>
                    )}
                  </div>
                  {body && <p className="mt-1 text-sm text-muted">{body}</p>}
                  <p className="mt-1.5 font-mono text-xs text-muted">
                    {new Date(row.createdAt).toLocaleString(locale)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
