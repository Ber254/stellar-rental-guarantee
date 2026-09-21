import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

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
  const t = getDictionary(locale);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-fg">{t.nav.notifications}</h1>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t.notifications.empty}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const { title, body } = renderNotification(t, row);
            return (
              <li key={row.id}>
                <Link
                  href={row.contractId ? `/contracts/${row.contractId}` : "#"}
                  className="block rounded-card border border-line bg-surface p-4 transition hover:border-accent"
                >
                  <p className="text-sm font-medium text-fg">{title}</p>
                  {body && <p className="mt-1 text-sm text-muted">{body}</p>}
                  <p className="mt-1 text-xs text-muted">
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
