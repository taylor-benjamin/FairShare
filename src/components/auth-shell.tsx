import type { ReactNode } from "react";

/** Centered card used by log-in, sign-up and invite pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-wash">
      <div className="bg-primary">
        <div className="mx-auto max-w-md px-4 py-6 text-white">
          <p className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-white text-primary">F</span>
            FairShare
          </p>
          <p className="mt-1 text-small text-white/85">Teamwork, made Fair.</p>
        </div>
      </div>
      <main className="mx-auto -mt-2 max-w-md px-4 pb-10">
        <div className="card mt-6 p-5 shadow-sm sm:p-6">
          <h1 className="text-heading">{title}</h1>
          {subtitle && <p className="mt-1 text-small text-hint">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </main>
    </div>
  );
}
