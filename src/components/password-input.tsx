"use client";

import { useState } from "react";

/** Password field with an eye button that shows or hides what you typed. */
export function PasswordInput({
  id,
  name = id,
  autoComplete,
  required,
  placeholder,
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required={required} placeholder={placeholder} className="field-input pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-(--radius-control) text-hint transition-colors hover:text-ink"
      >
        {visible ? (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.5-2.4 3.8M6.2 6.2C4.3 7.5 3 9.4 2.5 12c1 2.8 4.5 7 9.5 7 1.9 0 3.6-.6 5-1.5" />
          </svg>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <path d="M2.5 12C3.5 9.2 7 5 12 5s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7s-8.5-4.2-9.5-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
