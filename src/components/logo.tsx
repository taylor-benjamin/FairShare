// FairShare logo mark: three teammates on a white rounded tile — the member in front in orange.
// Redrawn from the team's FairShare logo (blue #2563EB, orange #F97316).

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="FairShare" className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="15" fill="#FFFFFF" />
      {/* Teammates behind (primary blue) */}
      <circle cx="20.5" cy="21" r="6" fill="#2563EB" />
      <circle cx="43.5" cy="21" r="6" fill="#2563EB" />
      <path d="M10 44v-6.5C10 32.5 13.5 30 20.5 30S31 32.5 31 37.5V44z" fill="#2563EB" />
      <path d="M33 44v-6.5c0-5 3.5-7.5 10.5-7.5S54 32.5 54 37.5V44z" fill="#2563EB" />
      {/* Member in front (accent orange), outlined in white so it separates from the others */}
      <circle cx="32" cy="24.5" r="7" fill="#F97316" stroke="#FFFFFF" strokeWidth="2.5" />
      <path d="M20.5 49v-7c0-5.5 4-8.5 11.5-8.5s11.5 3 11.5 8.5v7z" fill="#F97316" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Short rounded orange bar — the underline from the logo, used under titles. */
export function AccentBar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block h-1 w-10 rounded-full bg-accent ${className}`} />;
}
