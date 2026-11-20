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
const statTones: Record<StatTone, { card: string; dot: string; label: string }> = {
  primary: { card: "border-primary/15 bg-primary-tint", dot: "bg-primary", label: "text-primary-dark" },
  secondary: { card: "border-secondary/20 bg-secondary-tint", dot: "bg-secondary", label: "text-secondary-ink" },
  confirmed: { card: "border-confirmed/15 bg-confirmed-soft/45", dot: "bg-confirmed", label: "text-confirmed" },
  disputed: { card: "border-disputed/15 bg-disputed-soft/45", dot: "bg-disputed", label: "text-disputed" },
};

/** KPI tile tinted in its tone: colored label with a dot, big number, short caption. Tiles in a row share one height. */
export function StatTile({ label, value, caption, tone = "primary", href }: { label: string; value: ReactNode; caption?: string; tone?: StatTone; href?: string }) {
  const t = statTones[tone];
  const cls = `block h-full rounded-(--radius-card) border p-4 sm:p-5 ${t.card}`;
  const body = (
    <>
      <p className={`flex items-start gap-2 text-small font-semibold ${t.label}`}>
        <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${t.dot}`} />
        <span>{label}</span>
      </p>
      <p className="mt-2 text-[28px] leading-none font-semibold tracking-tight text-ink tabular-nums sm:text-[32px]">{value}</p>
      {caption && <p className="mt-2 text-small text-hint">{caption}</p>}
    </>
  );
  return href ? (
    <Link href={href} className={`${cls} transition hover:shadow-(--shadow-soft)`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
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
  crumbs,
  right,
  narrow,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  /** Breadcrumb trail above the title, e.g. Dashboard › Project. Shown instead of `back`. */
  crumbs?: { href: string; label: string }[];
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
            {crumbs && crumbs.length > 0 ? (
              <nav aria-label="Breadcrumb" className="mb-1.5">
                <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-small text-white/80">
                  {crumbs.map((c, i) => (
                    <li key={c.href} className="flex min-w-0 items-center gap-1.5">
                      {i > 0 && (
                        <span aria-hidden className="text-white/50">
                          ›
                        </span>
                      )}
                      <Link href={c.href} className="truncate rounded-full transition-colors hover:text-white hover:underline">
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : back && (
              <Link href={back.href} className="mb-1.5 inline-block rounded-full text-small text-white/80 transition-colors hover:text-white">
                <span className="inline-flex items-center gap-1">
                  <ArrowIcon direction="left" />
                  {back.label}
                </span>
              </Link>
            )}
            <h1 className="text-heading sm:truncate">{title}</h1>
            {subtitle && <p className="mt-0.5 text-small text-white/80 sm:truncate">{subtitle}</p>}
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

/**
 * A titled card holding a divided list (<li> rows). Shows `empty` when there are no rows.
 * `action` sits at the right of the title row, e.g. a filter dropdown.
 */
const panelTones = {
  plain: { head: "", dot: "", count: "bg-wash text-hint" },
  primary: { head: "bg-primary-tint", dot: "bg-primary", count: "bg-primary-soft text-primary-dark" },
  secondary: { head: "bg-secondary-tint", dot: "bg-secondary", count: "bg-secondary-soft text-secondary-ink" },
  confirmed: { head: "bg-confirmed-soft/45", dot: "bg-confirmed", count: "bg-confirmed-soft text-confirmed" },
  disputed: { head: "bg-disputed-soft/45", dot: "bg-disputed", count: "bg-disputed-soft text-disputed" },
} as const;

export function Panel({
  title,
  count,
  empty,
  action,
  tone = "plain",
  menus = false,
  children,
}: {
  title: string;
  count?: number;
  empty?: ReactNode;
  action?: ReactNode;
  /** Tints the title row in a theme color. */
  tone?: keyof typeof panelTones;
  /** Let dropdowns inside the rows (e.g. a MoreMenu) open past the card's edge. */
  menus?: boolean;
  children: ReactNode[];
}) {
  const t = panelTones[tone];
  return (
    <section className={`card flex flex-col ${menus ? "" : "overflow-hidden"}`}>
      <div className={`card-head rounded-t-(--radius-card) ${t.head}`}>
        <h2 className="flex items-center gap-2">
          {t.dot && <span aria-hidden className={`size-2 rounded-full ${t.dot}`} />}
          {title}
          {count !== undefined && count > 0 && <span className={`rounded-full px-2 py-0.5 text-small font-normal ${t.count}`}>{count}</span>}
        </h2>
        {action}
      </div>
      {children.length === 0 ? <div className="flex-1 px-4 py-6 text-center text-hint sm:px-5">{empty}</div> : <ul className="flex-1 divide-y divide-line">{children}</ul>}
    </section>
  );
}

/** A Panel row that links somewhere, with a trailing arrow. */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-primary-tint/60 sm:px-5">
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">{children}</span>
        <ArrowIcon className="shrink-0 text-hint" />
      </Link>
    </li>
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

/**
 * Tabs that live in the URL (?tab=…), so each section can be linked to and the back button works.
 * Renders as a pill bar that scrolls sideways on narrow phones.
 */
export function PageTabs({ base, active, items }: { base: string; active: string; items: { key: string; label: string; count?: number }[] }) {
  return (
    <nav aria-label="Sections" className="mb-6">
      <div className="pill-track !flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((t, i) => {
          const on = t.key === active;
          const href = i === 0 ? base : `${base}?tab=${t.key}`;
          return (
            <Link key={t.key} href={href} aria-current={on ? "page" : undefined} className="pill inline-flex items-center gap-1.5">
              {on && <span aria-hidden className="size-1.5 rounded-full bg-secondary" />}
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="rounded-full bg-wash px-1.5 text-[11px] text-hint">{t.count}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
