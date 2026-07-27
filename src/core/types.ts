export type RoundingMode = "none" | "6" | "15" | "30" | "60";

export interface Session {
  /** YYYY-MM-DD of the session start, local time */
  date: string;
  /** HH:MM local */
  start: string;
  /** HH:MM local */
  end: string;
  rawMinutes: number;
  billedMinutes: number;
  note: string;
}

export interface ActiveTimer {
  project: string;
  /** epoch milliseconds */
  startedAt: number;
}
