export const AGENTS_BLOCK_START = "<!-- bb-project-folders:agents:start -->";
export const AGENTS_BLOCK_END = "<!-- bb-project-folders:agents:end -->";
export const CUSTOM_BLOCK_START = "<!-- bb-project-folders:custom:start -->";
export const CUSTOM_BLOCK_END = "<!-- bb-project-folders:custom:end -->";

const START = AGENTS_BLOCK_START;
const END = AGENTS_BLOCK_END;

const escapeLiteral = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const blockPattern = new RegExp(`${escapeLiteral(START)}[\\s\\S]*?${escapeLiteral(END)}`);
const customPattern = new RegExp(
  `${escapeLiteral(CUSTOM_BLOCK_START)}[\\s\\S]*?${escapeLiteral(CUSTOM_BLOCK_END)}`,
);

export function agentsBlock(template: string) {
  return `${START}\n${template.trim()}\n${END}`;
}

/** The individual-rules block, or "" when the text is empty. */
export function customBlock(text: string) {
  const body = text.trim();
  return body ? `${CUSTOM_BLOCK_START}\n${body}\n${CUSTOM_BLOCK_END}` : "";
}

/** Upsert the custom block at the bottom; empty text removes it. null = no change. */
export function applyCustomBlock(
  existing: string | null,
  text: string,
): string | null {
  const block = customBlock(text);
  const base = existing ?? "";
  if (customPattern.test(base)) {
    const merged = block
      ? base.replace(customPattern, block)
      : base.replace(customPattern, "").replace(/\n{3,}$/, "\n");
    return merged === base ? null : merged;
  }
  if (!block) return null;
  return base.replace(/\n*$/, "\n") + "\n" + block + "\n";
}

/** The text currently stored between the markers, or null. */
export function readManagedBlock(existing: string | null | undefined) {
  if (!existing) return null;
  const match = existing.match(
    new RegExp(`${escapeLiteral(START)}\\n([\\s\\S]*?)\\n${escapeLiteral(END)}`),
  );
  return match ? match[1] : null;
}

/** null = the file does not need to change. */
export function applyAgentsBlock(
  existing: string | null,
  template: string,
): string | null {
  const body = template.trim();
  if (!body) return null;
  const block = agentsBlock(body);
  if (existing === null || existing.trim() === "") return block + "\n";
  if (blockPattern.test(existing)) {
    const merged = existing.replace(blockPattern, block);
    return merged === existing ? null : merged;
  }
  return existing.replace(/\n*$/, "\n") + "\n" + block + "\n";
}
