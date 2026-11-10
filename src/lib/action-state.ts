/** What every server action returns to its form. Safe to import from client components. */
export interface ActionState {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Echo of submitted values so a failed form keeps what the user typed. */
  values?: Record<string, string>;
  /** Bumps on every success so client components can react. */
  stamp?: number;
}
