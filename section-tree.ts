import type { Folder } from "./server";

/** The environment provider id registered on the server. */
export const SECTION_ENVIRONMENT_ID = "section";

export type SectionTree = { folders: Folder[]; roots: Folder[] };

/**
 * Sections of one project on one device, parents before children, each with
 * the depth its indent needs. Groups stay in the list: dropping them is the
 * caller's decision, since they hold sections and have no folder of their own.
 */
export function sectionOptions(
  tree: SectionTree,
  projectId: string,
  hostId: string,
) {
  const all = tree.folders.filter(
    (f) => f.projectId === projectId && f.hostId === hostId,
  );
  const out: { folder: Folder; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of all
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/**
 * Where the composer's chosen environment will run, as "Project / Section /
 * Subsection". Null when the environment is not a section of the tree: then
 * BB's own project chip already says everything there is to say.
 */
export function environmentLabel(
  tree: SectionTree & { bindings: Record<string, string> },
  environmentId: string,
): { label: string; path: string } | null {
  const folderId = tree.bindings[environmentId];
  if (!folderId) return null;
  const folder = tree.folders.find((f) => f.id === folderId);
  if (!folder) return null;
  const names: string[] = [];
  const visited = new Set<string>();
  for (
    let cur: Folder | undefined = folder;
    cur && !visited.has(cur.id);
    cur = cur.parentId
      ? tree.folders.find((x) => x.id === cur!.parentId)
      : undefined
  ) {
    visited.add(cur.id);
    names.unshift(cur.name);
  }
  const project = tree.roots.find((r) => r.projectId === folder.projectId);
  return {
    label: [project?.name, ...names].filter(Boolean).join(" / "),
    path: folder.path,
  };
}

/**
 * The environment the New thread composer currently has selected, read from
 * the keys BB persists for its own pickers. There is no composer hook for
 * this yet, so the keys are read — never written — and anything unexpected
 * simply means "no section to show".
 */
export function composerEnvironmentId(
  projectId: string | null,
  session: Pick<Storage, "getItem">,
): string | null {
  if (!projectId) return null;
  try {
    const value =
      session.getItem(
        `bb.promptbox.environment-${encodeURIComponent(projectId)}-1`,
      ) ?? "";
    return value.startsWith("reuse:") ? value.slice("reuse:".length) : null;
  } catch {
    return null;
  }
}

/**
 * The section chosen from the composer's own action, kept for the inputs
 * control BB renders beside the provider: the two live in different React
 * trees and only meet through this.
 */
let picked: { projectId: string; hostId: string; folderId: string } | null =
  null;
export const rememberPick = (next: typeof picked) => {
  picked = next;
};
export const recallPick = (projectId: string | null, hostId: string | null) =>
  picked && picked.projectId === projectId && picked.hostId === hostId
    ? picked.folderId
    : null;
