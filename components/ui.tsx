import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className={cn("flex flex-1 flex-col gap-6", className)}>{children}</div>
    </div>
  );
}

export function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/65 bg-[rgba(255,252,245,0.82)] p-5 shadow-[0_24px_80px_rgba(62,39,17,0.08)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-display text-2xl leading-tight text-stone-950">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-stone-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        tone === "success" &&
          "border-emerald-300 bg-emerald-100/80 text-emerald-800",
        tone === "warning" &&
          "border-amber-300 bg-amber-100/80 text-amber-800",
        tone === "danger" && "border-rose-300 bg-rose-100/80 text-rose-800",
        tone === "default" &&
          "border-stone-300 bg-white/80 text-stone-700",
      )}
    >
      {label}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[24px] border border-stone-200/80 bg-white/85 p-4 shadow-[0_12px_40px_rgba(43,32,20,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl leading-none text-stone-950">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-stone-600">{detail}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50/80 p-5 text-sm leading-6 text-stone-600">
      <p className="font-semibold text-stone-900">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}
