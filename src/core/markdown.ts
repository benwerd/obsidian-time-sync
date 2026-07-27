import { Session } from "./types";
import { formatDuration, formatHours } from "./time";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

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

const DAILY_HEADER = "| Start | End | Raw | Billed | Note |";
const DAILY_DIVIDER = "| ----- | --- | --- | ------ | ---- |";

/** Cell count of a table row line, ignoring escaped pipes (`\|`) inside cells. */
function tableCellCount(line: string): number {
  const pipes = line.replace(/\\\|/g, "").match(/\|/g);
  return pipes ? pipes.length - 1 : 0;
}

const DAILY_COLUMNS = tableCellCount(DAILY_HEADER);

function dailySessionRow(s: Session): string {
  const note = s.note.replace(/\n/g, " ").replace(/\|/g, "\\|");
  return `| ${s.start} | ${s.end} | ${formatDuration(s.rawMinutes)} | ${formatDuration(s.billedMinutes)} | ${note} |`;
}

export function createDailyFile(date: string, session: Session): string {
  return [`# ${date}`, "", DAILY_HEADER, DAILY_DIVIDER, dailySessionRow(session), ""].join("\n");
}

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

const INVOICES_HEADER = "| Date | Billable hours | Sessions total | Note |";
const INVOICES_DIVIDER = "| ---- | -------------- | -------------- | ---- |";
const INVOICE_COLUMNS = tableCellCount(INVOICES_HEADER);

export interface InvoiceRecord {
  date: string;
  /** minutes actually invoiced, after invoice rounding */
  invoicedMinutes: number;
  /** accumulated billed session minutes before invoice rounding */
  sessionsTotalMinutes: number;
  note: string;
}

function invoiceRow(r: InvoiceRecord): string {
  const note = r.note.replace(/\n/g, " ").replace(/\|/g, "\\|");
  return `| ${r.date} | ${formatHours(r.invoicedMinutes)} | ${formatHours(r.sessionsTotalMinutes)} | ${note} |`;
}

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

export function sanitizeProjectName(name: string): string {
  return name.replace(/[\\/:#^\[\]|?*]/g, "").trim();
}
