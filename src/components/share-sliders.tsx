"use client";

import { useState } from "react";
import { FULL_SHARE, parseSharePercent, rebalanceShares } from "@/lib/rules";

export interface ShareSliderMember {
  userId: number;
  name: string;
  role: string | null;
  isSelf: boolean;
  startBp: number;
}

const toText = (bp: number) => (bp / 100).toFixed(2);

/** One slider per team member. Moving one rebalances the others, so the total is always 100%. */
export function ShareSliders({ members }: { members: ShareSliderMember[] }) {
  const [shares, setShares] = useState(() => members.map((m) => m.startBp));
  const [touched, setTouched] = useState(() => members.map(() => false));
  // What's being typed in a percent box, so "12." isn't reformatted mid-keystroke.
  // `base` is the split before typing, so each keystroke rebalances from it and partial numbers leave no trace.
  const [draft, setDraft] = useState<{ index: number; text: string; base: number[] } | null>(null);

  const move = (index: number, bp: number) => {
    setShares((s) => rebalanceShares(s, index, bp, touched));
    setTouched((t) => t.map((v, i) => v || i === index));
  };
  const reset = () => {
    setShares(members.map((m) => m.startBp));
    setTouched(members.map(() => false));
    setDraft(null);
  };
  const total = shares.reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-5">
      {members.map((m, i) => (
        <fieldset key={m.userId} className="space-y-2">
          <legend className="font-semibold">
            {m.name}
            {m.isSelf && <span className="ml-1 font-normal text-primary-dark">(You)</span>}
            {m.role && <span className="ml-1 text-small font-normal text-hint">· {m.role}</span>}
          </legend>
          <div className="flex items-center gap-3">
            <input
              type="range"
              name={`share_${m.userId}`}
              min={0}
              max={100}
              step={0.01}
              value={toText(shares[i])}
              onChange={(e) => {
                setDraft(null);
                move(i, Math.round(Number(e.target.value) * 100));
              }}
              aria-label={`${m.name} share of the work`}
              className="h-11 min-w-0 flex-1 cursor-pointer accent-primary"
            />
            <span className="relative w-24 shrink-0">
              <input
                type="text"
                inputMode="decimal"
                value={draft?.index === i ? draft.text : toText(shares[i])}
                onChange={(e) => {
                  const text = e.target.value;
                  const base = draft?.index === i ? draft.base : shares;
                  setDraft({ index: i, text, base });
                  const bp = parseSharePercent(text);
                  if (bp !== null) {
                    setShares(rebalanceShares(base, i, bp, touched));
                    setTouched((t) => t.map((v, k) => v || k === i));
                  }
                }}
                onKeyDown={(e) => {
                  // Ratings can't be changed once submitted, so Enter here must not submit the form.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => setDraft(null)}
                aria-label={`${m.name} percent`}
                className="field-input pr-6 text-right tabular-nums"
              />
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-small text-hint">
                %
              </span>
            </span>
          </div>
          <label htmlFor={`comment_${m.userId}`} className="sr-only">
            Comment for {m.name}
          </label>
          <input id={`comment_${m.userId}`} name={`comment_${m.userId}`} placeholder="Optional comment for your instructor" maxLength={1000} className="field-input" />
        </fieldset>
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <button type="button" onClick={reset} className="link text-small">
          Reset
        </button>
        <p className={`font-semibold tabular-nums ${total === FULL_SHARE ? "text-confirmed" : "text-disputed"}`} role="status">
          Total {toText(total)}%
        </p>
      </div>
    </div>
  );
}
