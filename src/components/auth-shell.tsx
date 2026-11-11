import type { ReactNode } from "react";
import { AccentBar, LogoMark } from "./logo";

/** Centered card used by log-in, sign-up and invite pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-wash">
      <div className="bg-primary">
        <div className="mx-auto max-w-md px-4 py-6 text-white">
          <p className="flex items-center gap-2.5 text-heading font-semibold">
            <LogoMark size={36} className="shadow-sm" />
            FairShare
          </p>
          <AccentBar className="mt-2.5 ml-[46px]" />
          <p className="mt-2 ml-[46px] text-small text-white/85">Teamwork, made Fair.</p>
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
