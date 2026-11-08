import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import type { ContractStatus } from "@/lib/db/schema";

export function Card({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface/90 p-6 shadow-lg shadow-black/15 backdrop-blur-sm">
      {(title || actions) && (
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-line/60 pb-4">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const STATUS_TONES: Record<ContractStatus, string> = {
  DRAFT: "bg-neutral-bg text-neutral-fg border-line",
  PENDING_ACCEPTANCE: "bg-warn-bg/90 text-warn-fg border-warn-fg/30",
  AWAITING_FUNDING: "bg-warn-bg/90 text-warn-fg border-warn-fg/30",
  ACTIVE: "bg-ok-bg/90 text-ok-fg border-ok-fg/30",
  RETURN_REQUESTED: "bg-info-bg/90 text-info-fg border-info-fg/30",
  NEGOTIATION: "bg-info-bg/90 text-info-fg border-info-fg/30",
  AGREED: "bg-info-bg/90 text-info-fg border-info-fg/30",
  RELEASED: "bg-accent text-accent-fg border-accent",
  COMPLETED: "bg-accent text-accent-fg border-accent",
  CANCELLED: "bg-danger-bg/90 text-danger-fg border-danger-fg/30",
  REJECTED: "bg-danger-bg/90 text-danger-fg border-danger-fg/30",
  EXPIRED: "bg-warn-bg/90 text-warn-fg border-warn-fg/30",
};

export function StatusBadge({
  status,
  label,
}: {
  status: ContractStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-badge border px-3 py-1 text-xs font-semibold tracking-wide ${STATUS_TONES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-card border border-line bg-surface-muted/90 px-3.5 py-2.5 text-sm text-fg outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const tones = {
    primary:
      "bg-gradient-to-r from-[#12A8FF] via-[#3B68FF] to-[#6D28D9] text-white font-semibold shadow-md shadow-[#3B68FF]/25 hover:brightness-110 active:scale-[0.99]",
    secondary:
      "border border-line bg-surface-muted/80 text-fg hover:border-accent/70 hover:bg-surface-muted",
    danger:
      "border border-danger-fg/30 bg-danger-bg text-danger-fg hover:brightness-110",
  };
  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center rounded-card px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[variant]} ${className}`}
    />
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2.5 last:border-none">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-fg">{value}</dd>
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "warning";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-info-bg/90 text-info-fg border-info-fg/30",
    error: "bg-danger-bg/90 text-danger-fg border-danger-fg/30",
    warning: "bg-warn-bg/90 text-warn-fg border-warn-fg/30",
  };
  return (
    <p className={`rounded-card border px-4 py-3 text-sm font-medium ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-muted hover:text-fg"
    >
      {children}
    </Link>
  );
}
