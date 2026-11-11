import type { ReactNode } from "react";
import { AccentBar, LogoMark } from "./logo";

/** Centered card used by log-in, sign-up and invite pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-primary-deep pb-10">
        <span aria-hidden className="pointer-events-none absolute -top-20 right-[10%] -z-10 size-72 rounded-full bg-white/15 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 left-[5%] -z-10 size-80 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="mx-auto max-w-md px-4 py-7 text-white">
          <p className="flex items-center gap-2.5 text-heading font-semibold">
            <LogoMark size={40} className="shadow-md" />
            FairShare
          </p>
          <AccentBar className="mt-2.5 ml-[50px]" />
          <p className="mt-2 ml-[50px] text-small text-white/85">Teamwork, made Fair.</p>
        </div>
      </div>
      <main className="relative z-10 mx-auto -mt-8 max-w-md px-4 pb-10">
        <div className="card p-5 shadow-(--shadow-lift) sm:p-7">
          <h1 className="text-heading">{title}</h1>
          {subtitle && <p className="mt-1 text-small text-hint">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </main>
    </div>
  );
}
