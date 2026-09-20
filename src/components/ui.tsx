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
    <section className="rounded-card border border-line bg-surface p-6">
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
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
  DRAFT: "bg-neutral-bg text-neutral-fg",
  PENDING_ACCEPTANCE: "bg-warn-bg text-warn-fg",
  AWAITING_FUNDING: "bg-warn-bg text-warn-fg",
  ACTIVE: "bg-ok-bg text-ok-fg",
  RETURN_REQUESTED: "bg-info-bg text-info-fg",
  NEGOTIATION: "bg-info-bg text-info-fg",
  AGREED: "bg-neutral-bg text-neutral-fg",
  RELEASED: "bg-ok-bg text-ok-fg",
  COMPLETED: "bg-accent text-accent-fg",
  CANCELLED: "bg-danger-bg text-danger-fg",
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
      className={`inline-flex rounded-badge px-2.5 py-1 text-xs font-medium ${STATUS_TONES[status]}`}
    >
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
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "mt-1 w-full rounded-card border border-line bg-surface-muted px-3 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-accent";

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
    primary: "bg-accent text-accent-fg hover:opacity-90",
    secondary: "border border-line bg-surface-muted text-fg hover:border-accent",
    danger: "border border-line bg-danger-bg text-danger-fg hover:opacity-90",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-card px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[variant]} ${className}`}
    />
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-none">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-fg">{value}</dd>
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
    info: "bg-info-bg text-info-fg",
    error: "bg-danger-bg text-danger-fg",
    warning: "bg-warn-bg text-warn-fg",
  };
  return (
    <p className={`rounded-card border border-line px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-muted hover:text-fg">
      {children}
    </Link>
  );
}
