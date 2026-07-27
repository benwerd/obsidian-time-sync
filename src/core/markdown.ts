import { Session } from "./types";
import { formatDuration, formatHours } from "./time";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
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
  const merged: Record<string, string> = { ...parseFrontmatter(content) };
  for (const [key, value] of Object.entries(updates)) merged[key] = String(value);
  const block =
    "---\n" +
    Object.entries(merged)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n") +
    "\n---\n";
  const match = content.match(FRONTMATTER_RE);
  if (match) return block + content.slice(match[0].length);
  return block + "\n" + content;
}

const SESSIONS_HEADER = "| Date | Start | End | Raw | Billed | Note |";
const SESSIONS_DIVIDER = "| ---- | ----- | --- | --- | ------ | ---- |";

export function createProjectFile(name: string, created: string): string {
  return [
    "---",
    "uninvoiced_minutes: 0",
    `created: ${created}`,
    "---",
    "",
    `# ${name}`,
    "",
    "## Sessions",
    "",
    SESSIONS_HEADER,
    SESSIONS_DIVIDER,
    "",
    "## Invoices",
    "",
  ].join("\n");
}

function sessionRow(s: Session): string {
  const note = s.note.replace(/\n/g, " ").replace(/\|/g, "\\|");
  return `| ${s.date} | ${s.start} | ${s.end} | ${formatDuration(s.rawMinutes)} | ${formatDuration(s.billedMinutes)} | ${note} |`;
}

export function appendSession(content: string, session: Session): string {
  const lines = content.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim() === "## Sessions");
  if (headerIdx === -1) {
    const section = ["", "## Sessions", "", SESSIONS_HEADER, SESSIONS_DIVIDER, sessionRow(session)];
    return content.replace(/\n*$/, "\n") + section.join("\n") + "\n";
  }
  let lastTableIdx = -1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("|")) lastTableIdx = i;
    else if (t.startsWith("## ")) break;
  }
  if (lastTableIdx === -1) {
    lines.splice(headerIdx + 1, 0, "", SESSIONS_HEADER, SESSIONS_DIVIDER, sessionRow(session));
  } else {
    lines.splice(lastTableIdx + 1, 0, sessionRow(session));
  }
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

export function dailyLogLine(s: Session): string {
  const note = s.note ? ` — ${s.note.replace(/\n/g, " ")}` : "";
  return `- ${s.start}–${s.end} (raw ${formatDuration(s.rawMinutes)}, billed ${formatHours(s.billedMinutes)})${note}`;
}

export function sanitizeProjectName(name: string): string {
  return name.replace(/[\\/:#^\[\]|?*]/g, "").trim();
}
