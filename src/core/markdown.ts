import { Session } from "./types";
import { formatDuration, formatHours } from "./time";

/** Matches a leading YAML frontmatter block, capturing its inner content (group 1). */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parses top-level `key: value` pairs out of a note's frontmatter block.
 * Only used internally to read back the `uninvoiced_minutes` figure — indented
 * continuation lines (YAML lists, multi-line values) are intentionally skipped
 * since they aren't simple scalars, and are left untouched by the writer below.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    // Skip indented continuation lines (they start with whitespace)
    if (line.match(/^\s/)) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

/**
 * Writes `updates` into a note's frontmatter, editing line-wise rather than
 * re-serializing the whole block. Existing top-level keys are replaced in place;
 * new keys are appended; every other line — including YAML lists and multi-line
 * values the user added by hand — is preserved verbatim. This is what makes the
 * project note's frontmatter safe to treat as the source of truth for totals.
 */
export function setFrontmatterFields(
  content: string,
  updates: Record<string, string | number>
): string {
  const match = content.match(FRONTMATTER_RE);

  // Detect EOL type (CRLF or LF)
  const eol = content.includes("\r\n") ? "\r\n" : "\n";

  if (!match) {
    // Create frontmatter when missing
    const block = "---" + eol +
      Object.entries(updates)
        .map(([key, value]) => `${key}: ${value}`)
        .join(eol) +
      eol + "---" + eol;
    return block + eol + content;
  }

  // Edit existing frontmatter block line-wise
  const innerContent = match[1];
  const lines = innerContent.split(/\r?\n/);

  // Process updates: find and replace top-level keys, append new ones
  const processedKeys = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only process top-level lines (no leading whitespace)
    if (line.match(/^\s/)) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    if (key in updates) {
      lines[i] = `${key}: ${updates[key]}`;
      processedKeys.add(key);
    }
  }

  // Append new keys that weren't found
  for (const [key, value] of Object.entries(updates)) {
    if (!processedKeys.has(key)) {
      lines.push(`${key}: ${value}`);
    }
  }

  const block = "---" + eol + lines.join(eol) + eol + "---" + eol;
  return block + content.slice(match[0].length);
}

/**
 * Builds the initial content for a new project note: frontmatter seeded with
 * a zero uninvoiced total, a title heading, and an empty Invoices table.
 * The project note holds totals and invoices only — sessions live in daily logs.
 */
export function createProjectFile(name: string, created: string): string {
  return [
    "---",
    "uninvoiced_minutes: 0",
    `created: ${created}`,
    "---",
    "",
    `# ${name}`,
    "",
    "## Invoices",
    "",
    INVOICES_HEADER,
    INVOICES_DIVIDER,
    "",
  ].join("\n");
}

/** Header/divider pair identifying a daily log's session table; appends anchor on this exact pair. */
const DAILY_HEADER = "| Start | End | Raw | Billed | Note |";
const DAILY_DIVIDER = "| ----- | --- | --- | ------ | ---- |";

/** Cell count of a table row line, ignoring escaped pipes (`\|`) inside cells. */
function tableCellCount(line: string): number {
  const pipes = line.replace(/\\\|/g, "").match(/\|/g);
  return pipes ? pipes.length - 1 : 0;
}

/** Expected cell count for a well-formed daily-log row; used to detect where the table ends. */
const DAILY_COLUMNS = tableCellCount(DAILY_HEADER);

/** Renders a session as one daily-log table row, escaping newlines and pipes out of the note. */
function dailySessionRow(s: Session): string {
  const note = s.note.replace(/\n/g, " ").replace(/\|/g, "\\|");
  return `| ${s.start} | ${s.end} | ${formatDuration(s.rawMinutes)} | ${formatDuration(s.billedMinutes)} | ${note} |`;
}

/** Builds a new daily log file (one per project per day) seeded with its first session row. */
export function createDailyFile(date: string, session: Session): string {
  return [`# ${date}`, "", DAILY_HEADER, DAILY_DIVIDER, dailySessionRow(session), ""].join("\n");
}

/**
 * Appends a session row to a daily log's session table — the authoritative record
 * of individual sessions (the project note only holds rolled-up totals).
 *
 * Finds the table by its exact header/divider pair, then scans rows until the
 * first line whose cell count doesn't match the header, so unrelated hand-added
 * tables or code fences elsewhere in the file are never mistaken for the row
 * scan and can't be corrupted. If the header/divider pair isn't found at all,
 * a fresh table is appended rather than guessing at a location.
 */
export function appendDailySession(content: string, session: Session): string {
  const lines = content.split("\n");
  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() === DAILY_HEADER && lines[i + 1].trim() === DAILY_DIVIDER) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return (
      content.replace(/\n*$/, "\n") +
      ["", DAILY_HEADER, DAILY_DIVIDER, dailySessionRow(session)].join("\n") +
      "\n"
    );
  }
  let lastRowIdx = headerIdx + 1;
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("|") && tableCellCount(t) === DAILY_COLUMNS) lastRowIdx = i;
    else break;
  }
  lines.splice(lastRowIdx + 1, 0, dailySessionRow(session));
  return lines.join("\n");
}

/** Header/divider pair identifying the project note's Invoices table; appends anchor on this exact pair. */
const INVOICES_HEADER = "| Date | Sessions total | Billable hours | Note |";
const INVOICES_DIVIDER = "| ---- | -------------- | -------------- | ---- |";
const INVOICE_COLUMNS = tableCellCount(INVOICES_HEADER);

/** One row of the project note's Invoices table, recording a rounding decision at invoice time. */
export interface InvoiceRecord {
  date: string;
  /** minutes actually invoiced, after invoice rounding */
  invoicedMinutes: number;
  /** accumulated billed session minutes before invoice rounding */
  sessionsTotalMinutes: number;
  note: string;
}

/** Renders an invoice as one Invoices-table row, escaping newlines and pipes out of the note. */
function invoiceRow(r: InvoiceRecord): string {
  const note = r.note.replace(/\n/g, " ").replace(/\|/g, "\\|");
  return `| ${r.date} | ${formatHours(r.sessionsTotalMinutes)} | ${formatHours(r.invoicedMinutes)} | ${note} |`;
}

/**
 * Appends an invoice row to the project note's Invoices table.
 *
 * Mirrors `appendDailySession`'s anchoring strategy: finds the table by its
 * exact header/divider pair and stops the row scan at the first line with a
 * mismatched cell count, so hand-edited content elsewhere is left alone. If
 * the table is missing, it's recreated under the `## Invoices` heading (or
 * appended fresh if even that heading is gone) rather than guessing at a location.
 */
export function appendInvoice(content: string, invoice: InvoiceRecord): string {
  const lines = content.split("\n");
  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() === INVOICES_HEADER && lines[i + 1].trim() === INVOICES_DIVIDER) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    const table = [INVOICES_HEADER, INVOICES_DIVIDER, invoiceRow(invoice)];
    const sectionIdx = lines.findIndex((l) => l.trim() === "## Invoices");
    if (sectionIdx === -1) {
      return content.replace(/\n*$/, "\n") + ["", "## Invoices", "", ...table].join("\n") + "\n";
    }
    lines.splice(sectionIdx + 1, 0, "", ...table);
    return lines.join("\n");
  }
  let lastRowIdx = headerIdx + 1;
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("|") && tableCellCount(t) === INVOICE_COLUMNS) lastRowIdx = i;
    else break;
  }
  lines.splice(lastRowIdx + 1, 0, invoiceRow(invoice));
  return lines.join("\n");
}

/** Strips characters that are unsafe in vault file/folder names (path separators, wiki-link and Markdown syntax) and trims whitespace. */
export function sanitizeProjectName(name: string): string {
  return name.replace(/[\\/:#^\[\]|?*]/g, "").trim();
}
