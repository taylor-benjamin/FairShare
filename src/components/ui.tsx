// Design-system components (Milestone 2 §4.3): Button, Field, StatusChip, Header bar, cards.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "confirm" | "dispute" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark border border-primary",
  secondary: "bg-surface text-primary border border-primary hover:bg-primary-soft",
  confirm: "bg-confirmed text-white border border-confirmed hover:brightness-110",
  dispute: "bg-surface text-disputed border border-disputed hover:bg-disputed-soft",
  ghost: "bg-transparent text-ink border border-line hover:bg-wash",
};

export function buttonClass(variant: Variant = "primary", opts: { full?: boolean; small?: boolean } = {}) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
    opts.small ? "px-3 py-1.5 text-small" : "px-4 py-2.5 text-body",
    // "Full width on phones": stretches below the sm breakpoint, natural width above.
    opts.full ? "w-full sm:w-auto" : "",
    variants[variant],
  ].join(" ");
}

export function Button({ variant = "primary", full, small, className = "", ...props }: ComponentProps<"button"> & { variant?: Variant; full?: boolean; small?: boolean }) {
  return <button className={`${buttonClass(variant, { full, small })} ${className}`} {...props} />;
}

export function LinkButton({ variant = "primary", full, small, className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant; full?: boolean; small?: boolean }) {
  return <Link className={`${buttonClass(variant, { full, small })} ${className}`} {...props} />;
}

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-small text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-small text-disputed" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-small text-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export type ChipTone = "review" | "confirmed" | "disputed" | "pending" | "neutral" | "warning";
const chipTones: Record<ChipTone, string> = {
  review: "bg-primary-soft text-primary",
  confirmed: "bg-confirmed-soft text-confirmed",
  disputed: "bg-disputed-soft text-disputed",
  pending: "bg-wash text-hint",
  neutral: "bg-wash text-ink",
  warning: "bg-warning-soft text-warning",
};

export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-small whitespace-nowrap ${chipTones[tone]}`}>{children}</span>;
}

/** Primary-colored header bar: title in Heading, subtitle in Small, both white. */
export function HeaderBar({
  title,
  subtitle,
  back,
  right,
  narrow,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  right?: ReactNode;
  /** Match a <Page narrow> body so the title lines up with the content below it. */
  narrow?: boolean;
}) {
  return (
    <header className="bg-primary text-white">
      <div className={`mx-auto flex ${narrow ? "max-w-2xl" : "max-w-6xl"} items-start justify-between gap-3 px-4 py-4 sm:px-6`}>
        <div className="min-w-0">
          {back && (
            <Link href={back.href} className="mb-1 inline-block text-small text-white/85 hover:text-white">
              <span className="inline-flex items-center gap-1">
                <ArrowIcon direction="left" />
                {back.label}
              </span>
            </Link>
          )}
          <h1 className="truncate text-heading">{title}</h1>
          {subtitle && <p className="truncate text-small text-white/85">{subtitle}</p>}
          <span aria-hidden className="mt-2 block h-1 w-10 rounded-full bg-accent" />
        </div>
        {right}
      </div>
    </header>
  );
}

/** Soft, rounded arrow for navigation links. Sized to the surrounding text. */
export function ArrowIcon({ direction = "right", className = "" }: { direction?: "left" | "right"; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block h-[1.1em] w-[1.1em] shrink-0 ${direction === "left" ? "rotate-180" : ""} ${className}`}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Page({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <main className={`mx-auto w-full ${narrow ? "max-w-2xl" : "max-w-6xl"} px-4 py-6 sm:px-6`}>{children}</main>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error" | "warning"; children: ReactNode }) {
  const t = {
    info: "border-primary/30 bg-primary-soft text-ink",
    success: "border-confirmed/30 bg-confirmed-soft text-ink",
    error: "border-disputed/30 bg-disputed-soft text-disputed",
    warning: "border-warning/30 bg-warning-soft text-ink",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 text-body ${t}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-small text-hint">{children}</div>}
    </div>
  );
}

export function formatDate(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
}

export function formatHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "";
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
