import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Card } from "@/components/ui";

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  const t = getDictionary(await getLocale());

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-fg">{t.home.title}</h1>
        <p className="max-w-2xl text-muted">{t.home.intro}</p>
        <div className="flex gap-3">
          <Link
            href="/register"
            className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
          >
            {t.nav.signUp}
          </Link>
          <Link
            href="/login"
            className="rounded-card border border-line bg-surface px-4 py-2 text-sm font-medium text-fg"
          >
            {t.nav.signIn}
          </Link>
        </div>
      </div>

      <Card title={t.home.howItWorks}>
        <ol className="grid gap-3 sm:grid-cols-2">
          {t.home.steps.map((step) => (
            <li
              key={step.title}
              className="rounded-card border border-line bg-surface-muted p-4"
            >
              <p className="text-sm font-semibold text-fg">{step.title}</p>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
