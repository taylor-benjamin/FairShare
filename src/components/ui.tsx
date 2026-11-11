// Design-system components (Milestone 2 §4.3): Button, Field, StatusChip, Header bar, cards.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "confirm" | "dispute" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white border border-primary shadow-[0_4px_14px_rgb(37_99_235/0.25)] hover:bg-primary-dark hover:shadow-[0_6px_20px_rgb(37_99_235/0.3)]",
  secondary: "bg-surface text-primary border border-primary/40 hover:border-primary hover:bg-primary-tint",
  confirm: "bg-confirmed text-white border border-confirmed hover:brightness-110",
  dispute: "bg-surface text-disputed border border-disputed/50 hover:border-disputed hover:bg-disputed-soft",
  ghost: "bg-transparent text-ink border border-line hover:bg-wash",
};

export function buttonClass(variant: Variant = "primary", opts: { full?: boolean; small?: boolean } = {}) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-semibold transition duration-200 ease-(--ease-fluid) active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    opts.small ? "px-3.5 py-1.5 text-small" : "px-5 py-2.5 text-body",
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
  review: "bg-primary-soft text-primary-dark",
  confirmed: "bg-confirmed-soft text-confirmed",
  disputed: "bg-disputed-soft text-disputed",
  pending: "bg-wash text-hint",
  neutral: "bg-wash text-ink",
  warning: "bg-warning-soft text-warning",
};

/** Pill status label with a small leading dot in the tone's color. */
export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-small whitespace-nowrap ${chipTones[tone]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

type StatTone = "primary" | "secondary" | "confirmed" | "disputed";
const statTones: Record<StatTone, string> = {
  primary: "bg-primary-soft text-primary",
  secondary: "bg-secondary-soft text-secondary-ink",
  confirmed: "bg-confirmed-soft text-confirmed",
  disputed: "bg-disputed-soft text-disputed",
};

/** KPI tile: tinted icon square, label, big number, small caption. */
export function StatTile({ label, value, caption, tone = "primary", icon, href }: { label: string; value: ReactNode; caption?: string; tone?: StatTone; icon?: ReactNode; href?: string }) {
  const body = (
    <div className="flex items-start gap-3">
      <span className={`icon-tile ${statTones[tone]}`}>{icon ?? <span className="size-2.5 rounded-full bg-current" />}</span>
      <div className="min-w-0">
        <p className="text-small text-hint">{label}</p>
        <p className="text-display tabular-nums">{value}</p>
        {caption && <p className="mt-0.5 text-small text-hint">{caption}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="card block p-4 sm:p-5">
      {body}
    </Link>
  ) : (
    <div className="card p-4 sm:p-5">{body}</div>
  );
}

/** Rounded progress bar. Orange for brand highlights, blue by default. */
export function Progress({ value, tone = "primary", label }: { value: number; tone?: "primary" | "secondary" | "confirmed"; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = { primary: "bg-primary", secondary: "bg-secondary", confirmed: "bg-confirmed" }[tone];
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span className={fill} style={{ width: `${pct}%` }} />
    </div>
  );
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
    <header className={`mx-auto w-full ${narrow ? "max-w-2xl" : "max-w-6xl"} px-4 pt-5 sm:px-6 sm:pt-6`}>
      <div className="relative isolate overflow-hidden rounded-(--radius-card) bg-gradient-to-br from-primary via-primary-dark to-primary-deep px-5 py-5 text-white shadow-(--shadow-lift) sm:px-7 sm:py-6">
        {/* Soft orange + light-blue glows give the bar depth without competing with the text */}
        <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 -z-10 size-56 rounded-full bg-white/15 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 size-64 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {back && (
              <Link href={back.href} className="mb-1.5 inline-block rounded-full text-small text-white/80 transition-colors hover:text-white">
                <span className="inline-flex items-center gap-1">
                  <ArrowIcon direction="left" />
                  {back.label}
                </span>
              </Link>
            )}
            <h1 className="truncate text-heading">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-small text-white/80">{subtitle}</p>}
            <span aria-hidden className="mt-3 block h-1 w-12 rounded-full bg-secondary" />
          </div>
          {right}
        </div>
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
  return <main className={`mx-auto w-full ${narrow ? "max-w-2xl" : "max-w-6xl"} px-4 py-6 sm:px-6 sm:py-8`}>{children}</main>;
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
    <div className="rounded-(--radius-card) border-2 border-dashed border-line bg-surface/60 px-4 py-10 text-center">
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
