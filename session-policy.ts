import { z } from "zod";

/**
 * Session context rules: which BB plugins, skills, MCP servers and CLI
 * plugins an agent session started here loads.
 *
 * Enforcement lives in an experimental core extension
 * (`bb.agents.experimental_vkSessionPolicy`) that stock BB does not have. The
 * plugin only stores the rules and answers core's question per thread; on a
 * BB build without the extension the feature is hidden and nothing is sent.
 *
 * Inheritance works per group, like execution defaults: the nearest place
 * that sets a group wins — the section, its parents, the project, then the
 * plugin-wide default. `all` explicitly lifts a restriction a parent set.
 */
export const SESSION_POLICY_GROUPS = [
  "bbPlugins",
  "skills",
  "mcpServers",
  "nativePlugins",
] as const;
export type SessionPolicyGroup = (typeof SESSION_POLICY_GROUPS)[number];

const NAME_MAX = 200;
const NAMES_MAX = 500;

export const sessionFilterSchema = z.object({
  mode: z.enum(["all", "allow", "deny"]),
  names: z.array(z.string().trim().min(1).max(NAME_MAX)).max(NAMES_MAX),
});
export type SessionFilter = z.infer<typeof sessionFilterSchema>;

export const sessionPolicySchema = z.object({
  bbPlugins: sessionFilterSchema.optional(),
  skills: sessionFilterSchema.optional(),
  mcpServers: sessionFilterSchema.optional(),
  nativePlugins: sessionFilterSchema.optional(),
  userInstructions: z.boolean().optional(),
});
export type SessionPolicy = z.infer<typeof sessionPolicySchema>;

export const policyOriginSchema = z.object({
  scope: z.enum(["folder", "project", "global"]),
  folderId: z.string().nullable(),
});
export type PolicyOrigin = z.infer<typeof policyOriginSchema>;

export const resolvedSessionPolicySchema = z.object({
  bbPlugins: z
    .object({ value: sessionFilterSchema, origin: policyOriginSchema })
    .nullable(),
  skills: z
    .object({ value: sessionFilterSchema, origin: policyOriginSchema })
    .nullable(),
  mcpServers: z
    .object({ value: sessionFilterSchema, origin: policyOriginSchema })
    .nullable(),
  nativePlugins: z
    .object({ value: sessionFilterSchema, origin: policyOriginSchema })
    .nullable(),
  userInstructions: z
    .object({ value: z.boolean(), origin: policyOriginSchema })
    .nullable(),
});
export type ResolvedSessionPolicy = z.infer<typeof resolvedSessionPolicySchema>;

export interface SessionPolicyLayer {
  origin: PolicyOrigin;
  value: SessionPolicy;
}

/** Drops empty and duplicate names; an `allow`/`deny` group always stays. */
export function normalizeSessionPolicy(value: SessionPolicy): SessionPolicy {
  const out: SessionPolicy = {};
  for (const group of SESSION_POLICY_GROUPS) {
    const filter = value[group];
    if (!filter) continue;
    out[group] = {
      mode: filter.mode,
      names:
        filter.mode === "all"
          ? []
          : [...new Set(filter.names.map((n) => n.trim()).filter(Boolean))],
    };
  }
  if (value.userInstructions !== undefined)
    out.userInstructions = value.userInstructions;
  return out;
}

/** Nearest layer first; the first layer that sets a group wins it. */
export function resolveSessionPolicy(
  layers: readonly SessionPolicyLayer[],
): ResolvedSessionPolicy {
  const pick = <K extends keyof SessionPolicy>(key: K) => {
    for (const layer of layers) {
      const value = layer.value[key];
      if (value !== undefined) return { value, origin: layer.origin };
    }
    return null;
  };
  return {
    bbPlugins: pick("bbPlugins") as ResolvedSessionPolicy["bbPlugins"],
    skills: pick("skills") as ResolvedSessionPolicy["skills"],
    mcpServers: pick("mcpServers") as ResolvedSessionPolicy["mcpServers"],
    nativePlugins: pick(
      "nativePlugins",
    ) as ResolvedSessionPolicy["nativePlugins"],
    userInstructions: pick(
      "userInstructions",
    ) as ResolvedSessionPolicy["userInstructions"],
  };
}

/**
 * The policy core receives, or null when nothing narrows the session. `all`
 * groups are dropped: they only exist to override a parent here.
 */
export function toCorePolicy(
  resolved: ResolvedSessionPolicy,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const group of SESSION_POLICY_GROUPS) {
    const filter = resolved[group]?.value;
    if (filter && filter.mode !== "all") {
      out[group] = { mode: filter.mode, names: filter.names };
    }
  }
  if (resolved.userInstructions?.value === false) out.userInstructions = false;
  return Object.keys(out).length > 0 ? out : null;
}

/** What each CLI enforces, for the hint next to the editor. */
export const SESSION_POLICY_SUPPORT = {
  "claude-code": ["bbPlugins", "skills", "mcpServers", "nativePlugins"],
  codex: ["bbPlugins", "skills", "mcpServers", "nativePlugins"],
  "acp-opencode": ["bbPlugins", "skills", "mcpServers"],
  "acp-cursor": ["bbPlugins", "mcpServers"],
} as const satisfies Record<string, readonly SessionPolicyGroup[]>;
