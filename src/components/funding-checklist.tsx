import Link from "next/link";

import { Card } from "./ui";
import { fetchAccountSnapshot, shortenAddress } from "@/lib/stellar/network";

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
        ok ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg"
      }`}
    >
      {ok ? "✓" : "!"}
    </span>
  );
}

/**
 * Explains WHY the wallet must already hold USDC: Safexy never receives the
 * money, the guarantor signs a transfer straight from their own wallet into the
 * Soroban escrow. This card tells them exactly what is missing before they try.
 */
export async function FundingChecklist({
  wallet,
  requiredAmount,
  network,
  locale,
}: {
  wallet: string;
  requiredAmount: string;
  network: string;
  locale: string;
}) {
  const isEs = locale === "es";
  const snapshot = await fetchAccountSnapshot(wallet);
  const hasTrustline = snapshot.hasUsdcTrustline || !process.env.STELLAR_USDC_ISSUER;
  const usdc = Number(snapshot.usdc ?? "0");
  const required = Number(requiredAmount);
  const enoughUsdc = usdc >= required;
  const enoughXlm = Number(snapshot.xlm) >= 1.5;

  const items = [
    {
      ok: snapshot.exists,
      title: isEs ? "La wallet existe en la red" : "Wallet exists on the network",
      detail: snapshot.exists
        ? isEs
          ? "Tu cuenta ya está activada."
          : "Your account is already active."
        : isEs
          ? "Activá la cuenta enviándole al menos 1 XLM desde un exchange."
          : "Activate it by sending at least 1 XLM from an exchange.",
    },
    {
      ok: hasTrustline,
      title: isEs ? "Trustline de USDC habilitada" : "USDC trustline enabled",
      detail: hasTrustline
        ? isEs
          ? "Tu wallet ya puede recibir USDC."
          : "Your wallet can already receive USDC."
        : isEs
          ? "En Varial/Freighter: Manage assets → Add USDC. Sin esto el exchange no puede depositarte."
          : "In Varial/Freighter: Manage assets → Add USDC. Without it an exchange cannot deposit.",
    },
    {
      ok: enoughUsdc,
      title: isEs ? "Saldo USDC suficiente" : "Enough USDC balance",
      detail: isEs
        ? `Tenés ${usdc.toFixed(2)} USDC y la garantía es de ${required.toFixed(2)} USDC.`
        : `You have ${usdc.toFixed(2)} USDC and the guarantee is ${required.toFixed(2)} USDC.`,
    },
    {
      ok: enoughXlm,
      title: isEs ? "XLM para la comisión de red" : "XLM for the network fee",
      detail: isEs
        ? `Tenés ${Number(snapshot.xlm).toFixed(2)} XLM (se recomienda ≥ 1,5).`
        : `You have ${Number(snapshot.xlm).toFixed(2)} XLM (≥ 1.5 recommended).`,
    },
  ];

  const ready = items.every((item) => item.ok);

  return (
    <Card
      title={isEs ? "¿Cómo cargo el USDC de la garantía?" : "How do I load the USDC?"}
      description={
        isEs
          ? "El dinero nunca pasa por Safexy: sale de tu wallet a un contrato en Stellar cuando firmás."
          : "The money never goes through Safexy: it moves from your wallet into a Stellar contract when you sign."
      }
      actions={
        <Link
          href="/how-to-fund"
          className="rounded-card border border-line bg-surface-muted px-3 py-1.5 text-xs font-semibold text-fg transition hover:border-accent"
        >
          {isEs ? "Guía paso a paso" : "Step-by-step guide"}
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/70 bg-surface-muted/50 px-3 py-2">
        <span className="text-xs text-muted">
          {isEs ? "Wallet del garante" : "Guarantor wallet"}
        </span>
        <span className="font-mono text-xs text-fg">{shortenAddress(wallet)}</span>
      </div>

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <Check ok={item.ok} />
            <div>
              <p className="text-sm font-medium text-fg">{item.title}</p>
              <p className="text-xs text-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <p
        className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${
          ready ? "bg-ok-bg text-ok-fg" : "bg-warn-bg text-warn-fg"
        }`}
      >
        {ready
          ? isEs
            ? "Todo listo: podés registrar y depositar la garantía."
            : "All set: you can register and fund the guarantee."
          : isEs
            ? "Completá lo marcado y volvé a esta pantalla. La red es " + network + "."
            : "Complete the items above and come back. Network is " + network + "."}
      </p>
    </Card>
  );
}
