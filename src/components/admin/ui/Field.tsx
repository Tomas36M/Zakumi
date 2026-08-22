"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-tinta-60">{label}</span>
      {children}
      {error && <span className="text-xs text-peligro">{error}</span>}
    </label>
  );
}

const RELLENO =
  "w-full border-0 bg-isla-alta text-sm text-tinta placeholder:text-tinta-40 " +
  "focus:outline-2 focus:outline-acento disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input {...props} className={cn("h-control rounded-full px-4", RELLENO, className)} />
  );
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn("min-h-24 rounded-fila p-3 leading-relaxed", RELLENO, className)}
    />
  );
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative inline-flex w-full">
      <select
        {...props}
        className={cn("h-control appearance-none rounded-full px-4 pr-9", RELLENO, className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-40"
      />
    </span>
  );
}
