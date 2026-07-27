/** Rounding increment (in minutes) applied to session and invoice totals, or "none" for exact time. */
export type RoundingMode = "none" | "6" | "15" | "30" | "60";

/**
 * One completed time-tracking session for a project, as recorded in a daily log.
 * `billedMinutes` is `rawMinutes` rounded up per the session rounding setting at
 * stop time; it is the figure that accumulates into the project's uninvoiced total.
 */
export interface Session {
  /** YYYY-MM-DD of the session start, local time */
  date: string;
  /** HH:MM local */
  start: string;
  /** HH:MM local */
  end: string;
  /** Actual elapsed minutes, unrounded. */
  rawMinutes: number;
  /** `rawMinutes` rounded up per the session rounding setting; this is what gets billed. */
  billedMinutes: number;
  note: string;
}

/**
 * A running timer, persisted via `saveData` immediately on start so it survives
 * app quits or crashes and resumes counting from the original start time.
 */
export interface ActiveTimer {
  project: string;
  /** epoch milliseconds */
  startedAt: number;
}
