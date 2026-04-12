import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "default",
  children
}: {
  className?: string;
  tone?: "default" | "accent" | "success" | "warning";
  children: React.ReactNode;
}) {
  const tones = {
    default: "border-white/10 bg-white/5 text-slate-200",
    accent: "border-orange-300/20 bg-orange-400/10 text-orange-100",
    success: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
    warning: "border-amber-300/20 bg-amber-400/10 text-amber-100"
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const variants = {
    primary:
      "bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 hover:opacity-95",
    secondary:
      "border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
    ghost: "text-slate-200 hover:bg-white/5"
  } as const;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <div className="text-xs uppercase tracking-[0.24em] text-orange-100/80">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      {description ? <p className="max-w-3xl text-sm text-slate-300">{description}</p> : null}
    </div>
  );
}

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-300/40",
        props.className
      )}
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-orange-300/40",
        props.className
      )}
    />
  );
}
