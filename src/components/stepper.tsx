const STEPS = ["Project", "Class list", "Settings", "Publish"];

/** Setup progress for Linda: four plain steps, matching the Set Up Class Teams activity diagram. */
export function Stepper({ current, done = current - 1 }: { current: number; done?: number }) {
  return (
    <ol className="mb-8 grid grid-cols-4 gap-1.5 sm:gap-2" aria-label={`Setup step ${current} of ${STEPS.length}`}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n <= done ? "done" : n === current ? "current" : "todo";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="min-w-0 text-center">
            <div className={`h-1.5 rounded-full ${state === "todo" ? "bg-line" : state === "done" ? "bg-confirmed" : "bg-primary"}`} />
            <p
              className={`mt-1.5 truncate text-[12px] font-medium sm:text-small ${
                state === "current" ? "text-primary" : state === "done" ? "text-confirmed" : "text-hint"
              }`}
            >
              <span className="hidden sm:inline">{state === "done" ? "✓ " : `${n}. `}</span>
              {state === "done" && <span className="sm:hidden">✓ </span>}
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
