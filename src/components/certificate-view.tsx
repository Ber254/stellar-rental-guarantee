"use client";

import Link from "next/link";
import { useMemo } from "react";

import { encodeQrMatrix } from "@/lib/qr";
import { Button } from "./ui";

export function QrCodeSvg({
  value,
  size = 136,
}: {
  value: string;
  size?: number;
}) {
  const matrix = useMemo(() => encodeQrMatrix(value), [value]);
  const n = matrix.length;
  const quiet = 2;
  const total = n + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-lg border border-line bg-white p-1.5"
      aria-label="QR Code"
    >
      <rect width={total} height={total} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c + quiet}
              y={r + quiet}
              width={1}
              height={1}
              fill="#070b16"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function CertificateToolbar({
  contractId,
  backLabel,
  printLabel,
}: {
  contractId: string;
  backLabel: string;
  printLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link
        href={`/contracts/${contractId}`}
        className="rounded-card border border-line bg-surface-muted px-4 py-2 text-sm font-medium text-fg transition hover:border-accent"
      >
        ← {backLabel}
      </Link>
      <Button type="button" onClick={() => window.print()}>
        {printLabel}
      </Button>
    </div>
  );
}
