// Thresholds for the rule-based checks (P16) and early-warning signals.
// Change these numbers to make the checks stricter or looser.

export const INTEGRITY_RULES = {
  /** A rater must have rated at least this many teammates before "identical scores" can fire. */
  IDENTICAL_MIN_RATINGS: 2,
  /**
   * Reciprocal inflation: two members rate each other at least RECIPROCAL_MIN_SCORE,
   * and both of those scores beat the team's average rating for the milestone by at least RECIPROCAL_MARGIN.
   */
  RECIPROCAL_MIN_SCORE: 4,
  RECIPROCAL_MARGIN: 1.0,
} as const;

export const EARLY_WARNING = {
  /** A member with no logged work in this many days shows up as a warning. */
  INACTIVE_DAYS: 21,
} as const;
