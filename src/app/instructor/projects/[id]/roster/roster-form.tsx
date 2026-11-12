"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/forms";
import { LinkButton } from "@/components/ui";

type Mode = "file" | "paste";

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** P06 — upload (or paste) the class list. `action` is bound on the server (importRosterAction.bind(null, projectId)). */
export function RosterForm({ action: serverAction, backHref }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; backHref: string }) {
  const [state, action] = useActionState(serverAction, {});
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const problems = Object.values(state.fieldErrors ?? {});

  function pick(files: FileList | null) {
    const f = files?.[0] ?? null;
    setLocalError(null);
    if (f && !/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      setLocalError("That isn't a .csv file. In Excel or Google Sheets, use File → Save as / Download → CSV.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setLocalError(null);
      }}
      className={`flex-1 rounded-full px-3 py-2 text-small transition ${mode === m ? "bg-surface text-primary shadow-sm" : "text-hint hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <form
      action={action}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        if ((mode === "file" && !file) || (mode === "paste" && !pasted.trim())) {
          e.preventDefault();
          setLocalError(mode === "file" ? "Choose your class list file first." : "Paste your class list into the box first.");
        }
      }}
    >
      <div role="tablist" aria-label="How to add your class list" className="flex gap-1 rounded-full bg-wash p-1">
        {tab("file", "Upload a file")}
        {tab("paste", "Paste the list")}
      </div>

      {/* Only the active input carries a name, so the server never receives both. */}
      <div hidden={mode !== "file"}>
        <input
          ref={inputRef}
          id="roster"
          name={mode === "file" ? "roster" : undefined}
          type="file"
          accept=".csv,text/csv"
          className="peer sr-only"
          onChange={(e) => pick(e.target.files)}
        />
        <label
          htmlFor="roster"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (inputRef.current && e.dataTransfer.files.length) {
              inputRef.current.files = e.dataTransfer.files;
              pick(e.dataTransfer.files);
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition sm:py-10 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
            dragging ? "border-primary bg-primary-soft" : file ? "border-confirmed bg-confirmed-soft/40" : "border-line hover:border-primary hover:bg-primary-soft/40"
          }`}
        >
          {file ? (
            <>
              <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-confirmed text-white">
                ✓
              </span>
              <span className="max-w-full truncate font-semibold">{file.name}</span>
              <span className="text-small text-hint">{formatSize(file.size)} · ready to check</span>
              <span className="text-small font-semibold text-primary">Choose a different file</span>
            </>
          ) : (
            <>
              <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-semibold">
                <span className="text-primary">Choose your class list</span>
                <span className="hidden sm:inline"> or drag it here</span>
              </span>
              <span className="text-small text-hint">A .csv file, up to 500 KB</span>
            </>
          )}
        </label>
      </div>

      <div hidden={mode !== "paste"} className="space-y-1">
        <label htmlFor="pasted" className="block text-small">
          Paste your class list, including the header row
        </label>
        <textarea
          id="pasted"
          name={mode === "paste" ? "pasted" : undefined}
          rows={8}
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value);
            setLocalError(null);
          }}
          className="field-input font-mono text-small"
          placeholder={"first_name,last_name,email,team_name\nMarcus,Reed,marcus.reed@school.edu,Team Tigers"}
          spellCheck={false}
        />
        <p className="text-small text-hint">Copy the four columns from Excel or Google Sheets.</p>
      </div>

      {localError && (
        <p className="text-small text-disputed" role="alert">
          {localError}
        </p>
      )}

      {state.error && (
        <div className="rounded-lg border border-disputed/30 bg-disputed-soft p-4" role="alert">
          <p className="font-semibold text-disputed">{state.error}</p>
          {problems.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-disputed">
              {problems.slice(0, 15).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 15 && <li>…and {problems.length - 15} more.</li>}
            </ul>
          )}
          <p className="mt-2 text-small text-ink">Fix these in your spreadsheet, save it as CSV, and try again. Nothing was created yet.</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <LinkButton href={backHref} variant="secondary" full>
          Back
        </LinkButton>
        <SubmitButton full pendingText="Checking your list…">
          Next
        </SubmitButton>
      </div>
    </form>
  );
}
