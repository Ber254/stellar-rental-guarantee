import Link from "next/link";

import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { networkConfig } from "@/lib/stellar/network";

export default async function HowToFundPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const isEs = locale === "es";
  const cfg = networkConfig();

  const steps = isEs
    ? [
        {
          title: "1. Comprá USDC (o pesos) en un exchange",
          body: "Lemon, Ripio, Buenbit, Belo, Binance o Bitso. Podés comprar USDC directamente o comprar pesos y después cambiarlos a USDC dentro del exchange.",
        },
        {
          title: "2. Prepará tu propia wallet de Stellar",
          body: "Instalá Varial (ex-Freighter) y creá tu cuenta. Anotá la dirección pública: empieza con G y tiene 56 caracteres. Nunca compartas la frase semilla con nadie, ni siquiera con Safexy.",
        },
        {
          title: "3. Habilitá la trustline de USDC",
          body: "En Varial: Manage assets → Add asset → USDC. Sin trustline la wallet no puede recibir USDC y el exchange te va a rechazar el retiro.",
        },
        {
          title: "4. Retirá desde el exchange a tu wallet",
          body: "Elegí red Stellar, pegá tu dirección G…, y si el exchange te muestra un memo obligatorio, completalo tal cual. Mandá primero un monto chico de prueba.",
        },
        {
          title: "5. Bloqueá la garantía en Safexy",
          body: "Conectá la wallet, registrá el escrow y tocá 'Depositar y bloquear'. Vas a firmar una única transacción: el USDC pasa de tu wallet al contrato, no a Safexy.",
        },
        {
          title: "6. Al cerrar, el dinero vuelve solo a tu wallet",
          body: "Cada devolución total o parcial se transfiere automáticamente a la wallet del garante, descontando únicamente la comisión de plataforma sobre lo devuelto.",
        },
      ]
    : [
        {
          title: "1. Buy USDC (or local currency) on an exchange",
          body: "Lemon, Ripio, Buenbit, Belo, Binance or Bitso. You can buy USDC directly, or buy local currency and swap it inside the exchange.",
        },
        {
          title: "2. Set up your own Stellar wallet",
          body: "Install Varial (formerly Freighter) and create your account. Write down the public address: it starts with G and is 56 characters long. Never share your seed phrase with anyone, including Safexy.",
        },
        {
          title: "3. Enable the USDC trustline",
          body: "In Varial: Manage assets → Add asset → USDC. Without a trustline the wallet cannot receive USDC and the exchange will reject the withdrawal.",
        },
        {
          title: "4. Withdraw from the exchange to your wallet",
          body: "Pick the Stellar network, paste your G… address, and if the exchange shows a mandatory memo, fill it exactly. Send a small test amount first.",
        },
        {
          title: "5. Lock the guarantee in Safexy",
          body: "Connect the wallet, register the escrow and tap 'Fund and lock'. You sign a single transaction: the USDC goes from your wallet into the contract, never to Safexy.",
        },
        {
          title: "6. When it closes, the money goes back to your wallet",
          body: "Every full or partial return is transferred automatically to the guarantor's wallet, minus only the platform fee on what is returned.",
        },
      ];

  const warnings = isEs
    ? [
        "Elegí siempre la red Stellar. Si el exchange te ofrece ERC-20, TRON u otra red, el dinero se pierde.",
        "Verificá el memo antes de confirmar: sin memo, algunos exchanges no pueden acreditar el depósito y hay que reclamarlo por soporte.",
        "La wallet necesita un poco de XLM para las comisiones de red (se recomienda al menos 1,5 XLM).",
        "Safexy nunca te va a pedir tu frase semilla ni tu clave privada.",
      ]
    : [
        "Always choose the Stellar network. If the exchange offers ERC-20, TRON or another network, the money is lost.",
        "Double-check the memo before confirming: without it some exchanges cannot credit the deposit and you have to open a support ticket.",
        "The wallet needs a small amount of XLM for network fees (at least 1.5 XLM is recommended).",
        "Safexy will never ask for your seed phrase or private key.",
      ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          {isEs ? "¿Cómo cargo el USDC de la garantía?" : "How do I load the guarantee's USDC?"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isEs
            ? "Safexy no custodia el dinero. El garante bloquea USDC desde su propia wallet en un contrato inteligente de Stellar, y sólo se libera cuando las dos partes acuerdan."
            : "Safexy never custodies the money. The guarantor locks USDC from their own wallet into a Stellar smart contract, and it is only released when both parties agree."}
        </p>
      </div>

      <Card
        title={isEs ? "El camino recomendado" : "The recommended path"}
        description={
          isEs
            ? "Comprar → retirar por red Stellar → bloquear en Safexy."
            : "Buy → withdraw over the Stellar network → lock in Safexy."
        }
      >
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-card border border-line bg-surface-muted/50 p-4"
            >
              <p className="text-sm font-semibold text-fg">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 font-mono text-[11px] font-bold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.title.replace(/^\d+\.\s*/, "")}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={isEs ? "Ojo con esto" : "Watch out for this"}>
        <ul className="space-y-2">
          {warnings.map((warning) => (
            <li key={warning} className="flex gap-2 text-xs text-muted">
              <span className="text-warn-fg">▲</span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={isEs ? "Datos de la red que estás usando" : "Network details in use"}
      >
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-4 border-b border-line/60 pb-2">
            <dt className="text-muted">{isEs ? "Red" : "Network"}</dt>
            <dd className="font-mono text-fg">{cfg.network}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line/60 pb-2">
            <dt className="text-muted">{isEs ? "Código del activo" : "Asset code"}</dt>
            <dd className="font-mono text-fg">USDC</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line/60 pb-2">
            <dt className="text-muted">{isEs ? "Emisor" : "Issuer"}</dt>
            <dd className="break-all font-mono text-fg">
              {cfg.usdcContractId || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{isEs ? "Contrato del escrow" : "Escrow contract"}</dt>
            <dd className="break-all font-mono text-fg">
              {cfg.guaranteeContractId || "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-wrap gap-3">
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-card bg-gradient-to-r from-[#12A8FF] via-[#3B68FF] to-[#6D28D9] px-4 py-2.5 text-sm font-semibold text-white"
          >
            {isEs ? "Volver a mis garantías" : "Back to my guarantees"}
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-card bg-gradient-to-r from-[#12A8FF] via-[#3B68FF] to-[#6D28D9] px-4 py-2.5 text-sm font-semibold text-white"
          >
            {isEs ? "Ingresar" : "Sign in"}
          </Link>
        )}
        <Link
          href="/faq"
          className="rounded-card border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-fg"
        >
          {isEs ? "Preguntas frecuentes" : "FAQ"}
        </Link>
      </div>
    </div>
  );
}
