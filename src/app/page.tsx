import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Card } from "@/components/ui";
import { YieldCalculator } from "@/components/yield-calculator";

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const isEs = locale === "es";

  return (
    <div className="space-y-12">
      <div className="grid items-center gap-8 rounded-card border border-line bg-surface/80 p-6 shadow-xl shadow-black/20 sm:p-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1 text-xs font-semibold text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {isEs ? "Tu garantía, sin vueltas." : "Your guarantee, no runaround."}
            </div>
            <span className="text-xs font-medium text-muted">
              {isEs
                ? "Escrow no custodial en Stellar · USDC · 0,5% comisión"
                : "Non-custodial escrow on Stellar · USDC · 0.5% fee"}
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-5xl sm:leading-[1.12]">
            {t.home.title}
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {t.home.intro}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/register"
              className="rounded-card bg-gradient-to-r from-[#12A8FF] via-[#3B68FF] to-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#3B68FF]/25 transition hover:brightness-110"
            >
              {t.nav.signUp}
            </Link>
            <Link
              href="/login"
              className="rounded-card border border-line bg-surface-muted px-5 py-2.5 text-sm font-semibold text-fg transition hover:border-accent/70"
            >
              {t.nav.signIn}
            </Link>
            <Link
              href="/faq"
              className="px-3 py-2 text-sm font-medium text-muted transition hover:text-fg"
            >
              {t.nav.faq} →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-line/60 pt-5 text-xs">
            <div>
              <p className="font-mono text-base font-bold text-accent">100% USDC</p>
              <p className="text-muted">
                {isEs ? "Custodia en contrato Soroban" : "Held in Soroban contract"}
              </p>
            </div>
            <div>
              <p className="font-mono text-base font-bold text-fg">0,5%</p>
              <p className="text-muted">
                {isEs ? "Sólo sobre monto devuelto" : "Only on returned amount"}
              </p>
            </div>
            <div>
              <p className="font-mono text-base font-bold text-fg">2-de-2</p>
              <p className="text-muted">
                {isEs ? "Sin retiros unilaterales" : "No unilateral withdrawals"}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="space-y-4 rounded-card border border-line bg-surface-muted/80 p-5 shadow-inner">
            <div className="flex items-center justify-between border-b border-line/70 pb-3">
              <div>
                <p className="font-mono text-xs text-muted">SFX-2026-000201</p>
                <p className="text-sm font-semibold text-fg">Depto Palermo 4B</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-fg/30 bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-ok-fg" />
                {t.status.ACTIVE}
              </span>
            </div>

            <div className="rounded-lg border border-line/70 bg-surface p-4">
              <p className="text-xs text-muted">
                {isEs ? "Saldo protegido en Soroban" : "Protected balance on Soroban"}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-accent">1,000 USDC</p>
              <p className="mt-1 text-xs text-muted">
                {isEs
                  ? "Admite devoluciones parciales y extensiones on-chain"
                  : "Supports partial returns and on-chain extensions"}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-surface/60 px-3 py-2">
                <span className="text-muted">{t.dashboard.roleGuarantor}</span>
                <span className="font-mono font-medium text-fg">@alice.guarantor</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface/60 px-3 py-2">
                <span className="text-muted">{t.dashboard.roleLandlord}</span>
                <span className="font-mono font-medium text-fg">@bob.landlord</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card title={t.home.howItWorks}>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.steps.map((step, index) => (
            <li
              key={step.title}
              className="group relative rounded-card border border-line bg-surface-muted/60 p-5 transition hover:border-accent/60 hover:bg-surface-muted"
            >
              <span className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 font-mono text-xs font-bold text-accent">
                0{index + 1}
              </span>
              <p className="text-sm font-semibold text-fg">{step.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Card>

      <YieldCalculator locale={locale} />
    </div>
  );
}
