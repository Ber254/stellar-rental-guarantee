"use client";

import { useState } from "react";

import { Card, Field, Input } from "./ui";

export function YieldCalculator({ locale }: { locale: string }) {
  const isEs = locale === "es";
  const [amountStr, setAmountStr] = useState("1000");
  const [monthsStr, setMonthsStr] = useState("24");
  const [apyStr, setApyStr] = useState("5.5");

  const amount = Math.max(0, Number(amountStr) || 0);
  const months = Math.max(1, Math.min(120, Number(monthsStr) || 12));
  const apy = Math.max(0, Math.min(30, Number(apyStr) || 0));

  const safexyFee = amount * 0.005;
  const traditionalSuretyCost = amount * 1.5; // ~1.5x monthly deposit sunk cost
  const estimatedYield = amount * (apy / 100) * (months / 12);
  const netGainVsSurety = traditionalSuretyCost - safexyFee + estimatedYield;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Card
      title={
        isEs
          ? "Simulador de Costo y Rendimiento (Safexy vs. Caución Tradicional)"
          : "Cost & Yield Simulator (Safexy vs. Traditional Surety)"
      }
      description={
        isEs
          ? "Compará cuánto ahorrás bloqueando USDC en un escrow Soroban (0,5% fee) frente a un seguro de caución no reembolsable."
          : "Compare how much you save locking USDC in a Soroban escrow (0.5% fee) vs. a non-refundable surety bond."
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1">
          <Field
            label={isEs ? "Monto de la garantía (USDC)" : "Guarantee amount (USDC)"}
          >
            <Input
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
          </Field>
          <Field label={isEs ? "Duración del contrato (meses)" : "Lease duration (months)"}>
            <Input
              inputMode="numeric"
              value={monthsStr}
              onChange={(e) => setMonthsStr(e.target.value)}
            />
          </Field>
          <Field
            label={
              isEs
                ? "APY estimado en Stellar DeFi / Blend (%)"
                : "Estimated Stellar DeFi / Blend APY (%)"
            }
          >
            <Input
              inputMode="decimal"
              value={apyStr}
              onChange={(e) => setApyStr(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
          <div className="rounded-card border border-line bg-surface-muted/60 p-4">
            <p className="text-xs font-medium text-muted">
              {isEs ? "Seguro de caución tradicional" : "Traditional surety bond"}
            </p>
            <p className="mt-2 font-mono text-xl font-bold text-danger-fg">
              −{fmt(traditionalSuretyCost)} USDC
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {isEs
                ? "Prima perdida (no reembolsable al finalizar)"
                : "Sunk premium (non-refundable at lease end)"}
            </p>
          </div>

          <div className="rounded-card border border-accent/40 bg-accent/10 p-4">
            <p className="text-xs font-medium text-accent">
              {isEs ? "Comisión Safexy (0,5%)" : "Safexy Fee (0.5%)"}
            </p>
            <p className="mt-2 font-mono text-xl font-bold text-fg">
              {fmt(safexyFee)} USDC
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {isEs
                ? `Recuperás ${fmt(Math.max(0, amount - safexyFee))} USDC al cierre`
                : `You recover ${fmt(Math.max(0, amount - safexyFee))} USDC at close`}
            </p>
          </div>

          <div className="rounded-card border border-ok-fg/30 bg-ok-bg/60 p-4">
            <p className="text-xs font-medium text-ok-fg">
              {isEs
                ? "Rendimiento potencial + Ahorro"
                : "Potential Yield + Savings"}
            </p>
            <p className="mt-2 font-mono text-xl font-bold text-ok-fg">
              +{fmt(estimatedYield)} USDC
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {isEs
                ? `Ventaja neta total: +${fmt(netGainVsSurety)} USDC`
                : `Total net advantage: +${fmt(netGainVsSurety)} USDC`}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
