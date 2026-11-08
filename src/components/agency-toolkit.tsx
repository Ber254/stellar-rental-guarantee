"use client";

import { useState } from "react";

import { QrCodeSvg } from "./certificate-view";
import { Button, Card, Field, Input } from "./ui";

export type CsvGuaranteeRow = {
  reference: string;
  role: string;
  property: string;
  guaranteeAmount: string;
  lockedAmount: string;
  status: string;
  startDate: string;
  endDate: string;
  onChainId: string;
};

export function AgencyToolkit({
  userAlias,
  locale,
  rows,
}: {
  userAlias: string;
  locale: string;
  rows: CsvGuaranteeRow[];
}) {
  const isEs = locale === "es";
  const [openGenerator, setOpenGenerator] = useState(false);
  const [property, setProperty] = useState("");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("1000");
  const [rent, setRent] = useState("850");
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://rental-guarantee-stellar.vercel.app";

  const params = new URLSearchParams();
  if (userAlias) params.set("landlord", userAlias);
  if (amount) params.set("amount", amount);
  if (rent) params.set("rent", rent);
  if (property) params.set("property", property);
  if (address) params.set("address", address);
  const requestUrl = `${origin}/contracts/new?${params.toString()}`;

  function exportCsv() {
    const headers = [
      "Reference",
      "Role",
      "Property",
      "Guarantee_USDC",
      "Locked_USDC",
      "Status",
      "Start_Date",
      "End_Date",
      "OnChain_ID",
    ];
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.reference,
          r.role,
          `"${r.property.replace(/"/g, '""')}"`,
          r.guaranteeAmount,
          r.lockedAmount,
          r.status,
          r.startDate,
          r.endDate,
          r.onChainId,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safexy-guarantees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(requestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpenGenerator((v) => !v)}
        >
          {isEs
            ? "🏢 Modo Locador / Inmobiliaria: Link y QR de solicitud"
            : "🏢 Landlord / Agency Mode: Request Link & QR"}
        </Button>
        {rows.length > 0 && (
          <Button type="button" variant="secondary" onClick={exportCsv}>
            {isEs ? "⬇ Exportar cartera CSV" : "⬇ Export portfolio CSV"}
          </Button>
        )}
      </div>

      {openGenerator && (
        <Card
          title={
            isEs
              ? "Generador de solicitud pre-cargada para inquilino / garante"
              : "Pre-filled guarantee request generator for tenant / guarantor"
          }
          description={
            isEs
              ? "Compartí este link o QR con el garante para que abra el formulario con tu alias (@" +
                userAlias +
                ") y los datos del inmueble ya verificados."
              : "Share this link or QR with the guarantor so they open the form with your alias (@" +
                userAlias +
                ") and property details pre-verified."
          }
        >
          <div className="grid items-center gap-6 lg:grid-cols-12">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
              <Field label={isEs ? "Propiedad / Unidad" : "Property / Unit"}>
                <Input
                  value={property}
                  onChange={(e) => setProperty(e.target.value)}
                  placeholder="Depto Belgrano 2A"
                />
              </Field>
              <Field label={isEs ? "Dirección" : "Address"}>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Av. Cabildo 2100, CABA"
                />
              </Field>
              <Field label={isEs ? "Garantía solicitada (USDC)" : "Requested guarantee (USDC)"}>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label={isEs ? "Alquiler mensual (USDC)" : "Monthly rent (USDC)"}>
                <Input
                  inputMode="decimal"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2 pt-1 sm:col-span-2">
                <Button type="button" onClick={() => void copyLink()}>
                  {copied
                    ? isEs
                      ? "✓ Link copiado"
                      : "✓ Link copied"
                    : isEs
                      ? "Copiar link de solicitud"
                      : "Copy request link"}
                </Button>
                <span className="truncate font-mono text-xs text-muted">
                  {requestUrl}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 lg:col-span-4">
              <QrCodeSvg value={requestUrl} size={136} />
              <span className="font-mono text-[11px] text-muted">
                @{userAlias} · {amount || "0"} USDC
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
