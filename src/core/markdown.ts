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
  ].join("\n");
}

const DAILY_HEADER = "| Start | End | Raw | Billed | Note |";
const DAILY_DIVIDER = "| ----- | --- | --- | ------ | ---- |";

function dailySessionRow(s: Session): string {
  const note = s.note.replace(/\n/g, " ").replace(/\|/g, "\\|");
  return `| ${s.start} | ${s.end} | ${formatDuration(s.rawMinutes)} | ${formatDuration(s.billedMinutes)} | ${note} |`;
}

export function createDailyFile(date: string, session: Session): string {
  return [`# ${date}`, "", DAILY_HEADER, DAILY_DIVIDER, dailySessionRow(session), ""].join("\n");
}

export function appendDailySession(content: string, session: Session): string {
  const lines = content.split("\n");
  let lastTableIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("|")) lastTableIdx = i;
  }
  if (lastTableIdx === -1) {
    return (
      content.replace(/\n*$/, "\n") +
      ["", DAILY_HEADER, DAILY_DIVIDER, dailySessionRow(session)].join("\n") +
      "\n"
    );
  }
  lines.splice(lastTableIdx + 1, 0, dailySessionRow(session));
  return lines.join("\n");
}

export function appendInvoice(content: string, date: string, hours: string): string {
  const line = `- ${date}: ${hours}`;
  const lines = content.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim() === "## Invoices");
  if (headerIdx === -1) {
    return content.replace(/\n*$/, "\n") + ["", "## Invoices", "", line].join("\n") + "\n";
  }
  let lastIdx = headerIdx;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("- ")) lastIdx = i;
    else if (t.startsWith("## ")) break;
  }
  lines.splice(lastIdx + 1, 0, line);
  return lines.join("\n");
}

export function sanitizeProjectName(name: string): string {
  return name.replace(/[\\/:#^\[\]|?*]/g, "").trim();
}

export function invoiceHoursLabel(rawMinutes: number, billedMinutes: number): string {
  const billed = formatHours(billedMinutes);
  return rawMinutes === billedMinutes ? billed : `${billed} (raw ${formatHours(rawMinutes)})`;
}
