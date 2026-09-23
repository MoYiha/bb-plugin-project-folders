import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";

/**
 * Names the session rules editor offers as suggestions: MCP servers and CLI
 * plugins the machine's CLIs load by themselves. Read on the machine because
 * these live in its home folder; a missing or unreadable file contributes
 * nothing. Only names leave the machine, never commands, URLs or secrets.
 */
export const sessionInventoryInput = z
  .object({ cwd: z.string().nullable() })
  .strict();
const inventoryItem = z.object({
  name: z.string(),
  sources: z.array(z.enum(["claude", "codex", "opencode"])),
});
export const sessionInventoryOutput = z.object({
  mcpServers: z.array(inventoryItem),
  nativePlugins: z.array(inventoryItem),
});
export type SessionInventory = z.infer<typeof sessionInventoryOutput>;
type Source = "claude" | "codex" | "opencode";

export async function sessionInventory(
  input: z.infer<typeof sessionInventoryInput>,
): Promise<SessionInventory> {
  const home = homedir();
  const mcp = new Map<string, Set<Source>>();
  const plugins = new Map<string, Set<Source>>();
  const add = (map: Map<string, Set<Source>>, name: string, source: Source) =>
    map.set(name, (map.get(name) ?? new Set<Source>()).add(source));

  const claude = await readJson(path.join(home, ".claude.json"));
  for (const name of Object.keys(asObject(claude.mcpServers)))
    add(mcp, name, "claude");
  if (input.cwd) {
    const project = asObject(asObject(claude.projects)[input.cwd]);
    for (const name of Object.keys(asObject(project.mcpServers)))
      add(mcp, name, "claude");
    const dotMcp = await readJson(path.join(input.cwd, ".mcp.json"));
    for (const name of Object.keys(asObject(dotMcp.mcpServers)))
      add(mcp, name, "claude");
  }
  const claudeSettings = await readJson(
    path.join(home, ".claude", "settings.json"),
  );
  for (const [id, on] of Object.entries(
    asObject(claudeSettings.enabledPlugins),
  ))
    if (on === true) add(plugins, id, "claude");

  const codexHome = process.env.CODEX_HOME || path.join(home, ".codex");
  const codexConfig = await readText(path.join(codexHome, "config.toml"));
  for (const line of codexConfig.split(/\r?\n/u)) {
    const m =
      /^\s*\[\s*(mcp_servers|plugins)\s*\.\s*("([^"]+)"|([^.\]\s]+))/u.exec(
        line,
      );
    const name = m?.[3] ?? m?.[4];
    if (!m || !name) continue;
    add(m[1] === "mcp_servers" ? mcp : plugins, name, "codex");
  }

  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  for (const file of ["opencode.json", "opencode.jsonc"]) {
    const text = await readText(path.join(configHome, "opencode", file));
    const config = parseLoose(text);
    for (const name of Object.keys(asObject(config.mcp)))
      add(mcp, name, "opencode");
  }

  const list = (map: Map<string, Set<Source>>) =>
    [...map]
      .map(([name, sources]) => ({ name, sources: [...sources].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  return { mcpServers: list(mcp), nativePlugins: list(plugins) };
}

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return parseLoose(await readText(file));
}

/** JSON, tolerating `//` line comments and trailing commas (JSONC). */
function parseLoose(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    return asObject(JSON.parse(text));
  } catch {
    try {
      const stripped = text
        .replace(/^\s*\/\/.*$/gmu, "")
        .replace(/,(\s*[}\]])/gu, "$1");
      return asObject(JSON.parse(stripped));
    } catch {
      return {};
    }
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
