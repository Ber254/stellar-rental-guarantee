"use client";

import { useState } from "react";

const EVIDENCE_RE = /\[SHA-256:\s*([a-f0-9]{64})\s*·\s*([^\]]+)\]/i;

export async function sha256HexOfFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function parseProposalReason(reason: string | null): {
  cleanReason: string;
  sha256: string | null;
  fileName: string | null;
} {
  if (!reason) return { cleanReason: "", sha256: null, fileName: null };
  const match = EVIDENCE_RE.exec(reason);
  if (!match) return { cleanReason: reason, sha256: null, fileName: null };
  return {
    cleanReason: reason.replace(EVIDENCE_RE, "").trim(),
    sha256: match[1].toLowerCase(),
    fileName: match[2].trim(),
  };
}

export function EvidenceVerifier({
  reason,
  locale,
}: {
  reason: string | null;
  locale: string;
}) {
  const isEs = locale === "es";
  const { cleanReason, sha256, fileName } = parseProposalReason(reason);
  const [status, setStatus] = useState<"idle" | "match" | "mismatch">("idle");

  if (!cleanReason && !sha256) return null;

  async function onCheckFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !sha256) return;
    const computed = await sha256HexOfFile(file);
    setStatus(computed.toLowerCase() === sha256 ? "match" : "mismatch");
  }

  return (
    <div className="mt-1 space-y-1.5">
      {cleanReason && <p className="text-xs text-muted">“{cleanReason}”</p>}
      {sha256 && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px]">
          <span className="font-mono font-semibold text-accent">
            SHA-256: {sha256.slice(0, 12)}…{sha256.slice(-6)}
          </span>
          {fileName && <span className="text-muted">({fileName})</span>}
          <label className="cursor-pointer rounded border border-line bg-surface px-2 py-0.5 font-medium text-fg transition hover:border-accent">
            {isEs ? "Verificar archivo" : "Verify file"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => void onCheckFile(e)}
            />
          </label>
          {status === "match" && (
            <span className="font-semibold text-ok-fg">
              ✓ {isEs ? "Integridad verificada" : "Integrity verified"}
            </span>
          )}
          {status === "mismatch" && (
            <span className="font-semibold text-danger-fg">
              ✕ {isEs ? "Hash no coincide" : "Hash mismatch"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
