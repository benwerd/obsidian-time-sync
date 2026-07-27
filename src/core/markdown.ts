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
