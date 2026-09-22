"use client";

import { useState } from "react";

export function HowItWorks({ label, body }: { label: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        {label}
      </button>
      {open && <p className="mt-2 text-sm text-muted">{body}</p>}
    </div>
  );
}
