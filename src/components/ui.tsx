import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import type { ContractStatus } from "@/lib/db/schema";
import { STATUS_LABELS } from "@/lib/contract-state";

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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const STATUS_TONES: Record<ContractStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_ACCEPTANCE: "bg-amber-100 text-amber-800",
  AWAITING_FUNDING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  RETURN_REQUESTED: "bg-sky-100 text-sky-800",
  NEGOTIATION: "bg-indigo-100 text-indigo-800",
  AGREED: "bg-violet-100 text-violet-800",
  RELEASED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-600 text-white",
  CANCELLED: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONES[status]}`}
    >
      {STATUS_LABELS[status]}
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
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900";

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
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    danger: "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[variant]} ${className}`}
    />
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-none">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
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
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
