"use client";

import { useState } from "react";

/** Copies an invite link so the instructor can share it directly (chat, text) if email doesn't arrive. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("Copy this invite link:", url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-full px-2.5 py-1 text-small font-semibold text-primary transition hover:bg-primary-tint"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
