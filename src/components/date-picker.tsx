"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * A date field with our own rounded calendar, so it matches the rest of the app
 * (the browser's built-in calendar popup can't be styled). Submits YYYY-MM-DD under `name`,
 * like <input type="date">. Works controlled (`value` + `onChange`) or uncontrolled (`defaultValue`),
 * and goes back to `defaultValue` when its form is reset.
 */
export function DatePicker({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  invalid,
  clearable = false,
}: {
  id: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  clearable?: boolean;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(current || localToday());
  const [place, setPlace] = useState({ right: false, up: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const set = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };
  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max);

  // Form reset puts the uncontrolled value back.
  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form) return;
    const onReset = () => setInner(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Move keyboard focus to the focused day while the calendar is open.
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  // Open on the side with room: right-aligned near the screen's right edge, upward near the bottom.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPlace({ right: window.innerWidth - r.left < 300, up: window.innerHeight - r.bottom < 370 && r.top > 370 });
  }, [open]);

  const toggle = () => {
    if (!open) setFocused(current || clamp(localToday(), min, max));
    setOpen((o) => !o);
  };
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const pick = (d: string) => {
    if (!allowed(d)) return;
    set(d);
    close();
  };

  const onGridKey = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      setFocused((f) => addDays(f, moves[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setFocused((f) => addMonths(f, e.key === "PageUp" ? -1 : 1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setFocused((f) => addDays(f, e.key === "Home" ? -weekday(f) : 6 - weekday(f)));
    }
  };

  const [fy, fm] = focused.split("-").map(Number);
  const first = `${fy}-${pad(fm)}-01`;
  const start = addDays(first, -weekday(first));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = localToday();
  const monthLabel = new Date(Date.UTC(fy, fm - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <input ref={hiddenRef} type="hidden" name={name} value={current} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className="field-input flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${current ? "" : "text-hint"}`}>{current ? formatLong(current) : placeholder}</span>
        <CalendarIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className={`absolute z-30 w-72 rounded-(--radius-card) border border-line bg-surface p-3 shadow-(--shadow-lift) ${place.right ? "right-0" : "left-0"} ${place.up ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setFocused((f) => addMonths(f, -1))} aria-label="Previous month" className="grid size-8 place-items-center rounded-full text-hint transition hover:bg-wash hover:text-ink">
              <Chevron dir="left" />
            </button>
            <p className="font-semibold" aria-live="polite">
              {monthLabel}
            </p>
            <button type="button" onClick={() => setFocused((f) => addMonths(f, 1))} aria-label="Next month" className="grid size-8 place-items-center rounded-full text-hint transition hover:bg-wash hover:text-ink">
              <Chevron dir="right" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[12px] text-hint" aria-hidden>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const inMonth = Number(d.slice(5, 7)) === fm;
              const selected = d === current;
              const ok = allowed(d);
              return (
                <button
                  key={d}
                  type="button"
                  data-date={d}
                  tabIndex={d === focused ? 0 : -1}
                  disabled={!ok}
                  onClick={() => pick(d)}
                  aria-label={formatLong(d)}
                  aria-pressed={selected}
                  aria-current={d === today ? "date" : undefined}
                  className={[
                    "grid aspect-square place-items-center rounded-full text-small transition duration-150",
                    selected ? "bg-primary font-semibold text-white" : ok ? "hover:bg-primary-tint" : "",
                    !selected && d === today ? "font-semibold text-primary ring-1 ring-primary/40" : "",
                    !selected && !inMonth ? "text-hint/60" : "",
                    !ok ? "cursor-not-allowed text-hint/40 line-through" : "",
                  ].join(" ")}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-small">
            {allowed(today) ? (
              <button type="button" onClick={() => pick(today)} className="rounded-full px-3 py-1.5 font-semibold text-primary transition hover:bg-primary-tint">
                Today
              </button>
            ) : (
              <span />
            )}
            {clearable && current && (
              <button
                type="button"
                onClick={() => {
                  set("");
                  close();
                }}
                className="rounded-full px-3 py-1.5 text-hint transition hover:bg-wash hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plain YYYY-MM-DD date math (UTC, so no time zone shifts) ────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
const addMonths = (s: string, n: number) => {
  const [y, m, d] = s.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))));
};
const weekday = (s: string) => parse(s).getUTCDay();
const clamp = (s: string, min?: string, max?: string) => (min && s < min ? min : max && s > max ? max : s);
const formatLong = (s: string) => parse(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Today's date on this device (YYYY-MM-DD). */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function CalendarIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[1.1rem] shrink-0 text-hint">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}
