import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

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
  void t;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-fg">{t.nav.notifications}</h1>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t.notifications.empty}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.contractId ? `/contracts/${row.contractId}` : "#"}
                className="block rounded-card border border-line bg-surface p-4 transition hover:border-accent"
              >
                <p className="text-sm font-medium text-fg">{row.title}</p>
                {row.body && <p className="mt-1 text-sm text-muted">{row.body}</p>}
                <p className="mt-1 text-xs text-muted">
                  {new Date(row.createdAt).toLocaleString(locale)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
