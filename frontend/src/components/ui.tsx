import { ReactNode } from "react";

const toneStyles: Record<string, string> = {
  neutral: "bg-line/60 text-inkmuted",
  good: "bg-locker-50 text-locker-700",
  warn: "bg-ochre-400/20 text-ochre-500",
  bad: "bg-brick-50 text-brick-600",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof toneStyles; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneStyles[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-5 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-inkmuted">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-[15px] text-inkmuted">{subtitle}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-brick-300 bg-brick-50 px-4 py-2.5 text-sm text-brick-600">
      {message}
    </div>
  );
}
