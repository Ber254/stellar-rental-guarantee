"use client";

import { useState } from "react";

export function HowItWorks({ label, body }: { label: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-card border border-line/80 bg-surface-muted/50 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-medium text-accent"
      >
        <span className="inline-flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
            ?
          </span>
          {label}
        </span>
        <span className="text-xs text-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open && <p className="mt-2.5 border-t border-line/60 pt-2.5 text-sm leading-relaxed text-muted">{body}</p>}
    </div>
  );
}
