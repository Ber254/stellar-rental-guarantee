"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatUsdc } from "@/lib/money";
import { Button, Card } from "./ui";

type OnChainResponse = {
  configured: boolean;
  registered: boolean;
  synced?: boolean;
  onChainId?: string;
  sorobanContractId?: string;
  onChain: {
    state: string;
    locked: string;
    funded: string;
    endDate: string;
    feeQuote: string;
    guarantor: string;
    landlord: string;
  } | null;
};

export function OnChainInspector({
  contractId,
  locale,
}: {
  contractId: string;
  locale: string;
}) {
  const router = useRouter();
  const isEs = locale === "es";
  const [data, setData] = useState<OnChainResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load(sync = false) {
    if (sync) setSyncing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/onchain`, {
        method: sync ? "POST" : "GET",
      });
      if (res.ok) {
        const body = (await res.json()) as OnChainResponse;
        setData(body);
        if (sync) router.refresh();
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contracts/${contractId}/onchain`);
        if (!cancelled && res.ok) {
          const body = (await res.json()) as OnChainResponse;
          setData(body);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  return (
    <Card
      title={
        isEs
          ? "Verificación en vivo desde Soroban RPC"
          : "Live Soroban RPC Verification"
      }
      description={
        isEs
          ? "Lectura directa del ledger de Stellar Testnet (get_guarantee + quote_fee)"
          : "Direct read from Stellar Testnet ledger (get_guarantee + quote_fee)"
      }
      actions={
        <Button
          type="button"
          variant="secondary"
          disabled={loading || syncing}
          onClick={() => void load(true)}
        >
          {syncing
            ? isEs
              ? "Sincronizando…"
              : "Syncing…"
            : isEs
              ? "Sincronizar con Stellar RPC"
              : "Sync with Stellar RPC"}
        </Button>
      }
    >
      {loading ? (
        <p className="text-xs text-muted">
          {isEs
            ? "Consultando estado en Soroban RPC…"
            : "Querying state on Soroban RPC…"}
        </p>
      ) : !data?.configured ? (
        <p className="text-xs text-muted">
          {isEs
            ? "Modo simulado activo (sin contrato Soroban configurado)."
            : "Simulated mode active (no Soroban contract configured)."}
        </p>
      ) : !data.registered || !data.onChain ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {isEs
              ? "Esta garantía aún no fue registrada en el contrato Soroban on-chain."
              : "This guarantee has not been registered on the Soroban contract yet."}
          </span>
          {data.onChainId && (
            <span className="font-mono">On-Chain ID: {data.onChainId}</span>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-line/70 bg-surface-muted/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {isEs ? "Estado On-Chain" : "On-Chain State"}
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-ok-fg">
              ● {data.onChain.state}
            </p>
          </div>
          <div className="rounded-lg border border-line/70 bg-surface-muted/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {isEs ? "Locked (Soroban)" : "Locked (Soroban)"}
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-accent">
              {formatUsdc(data.onChain.locked)}
            </p>
          </div>
          <div className="rounded-lg border border-line/70 bg-surface-muted/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {isEs ? "Total Fondeado" : "Total Funded"}
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-fg">
              {formatUsdc(data.onChain.funded)}
            </p>
          </div>
          <div className="rounded-lg border border-line/70 bg-surface-muted/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {isEs ? "Fee Estimado (0,5%)" : "Quoted Fee (0.5%)"}
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-fg">
              {formatUsdc(data.onChain.feeQuote)}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
