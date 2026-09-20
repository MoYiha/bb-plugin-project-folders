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
 * The section chosen from the composer's own action or from the chip, kept
 * for the inputs control BB renders beside the provider and for the chip
 * itself: they live in different React trees and only meet through this.
 *
 * It outlives them both, in the tab's own storage. Applying a project
 * remounts every plugin surface in the composer, and that is exactly when the
 * pick has just been made — a choice kept only in a component would be
 * forgotten by the act of applying it.
 */
type ComposerPick = { projectId: string; hostId: string; folderId: string };
const PICK_KEY = "pf.composer.pick";
let picked: ComposerPick | null = null;
let loaded = false;
const pickWatchers = new Set<() => void>();
const tabStorage = () => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};
export const rememberPick = (next: ComposerPick | null) => {
  picked = next;
  loaded = true;
  try {
    if (next) tabStorage()?.setItem(PICK_KEY, JSON.stringify(next));
    else tabStorage()?.removeItem(PICK_KEY);
  } catch {
    // A tab that refuses storage still has the value for this page's life.
  }
  for (const fn of Array.from(pickWatchers)) fn();
};
/**
 * The pick as a store, because every surface that shows it is somewhere else:
 * the chip in BB's project control, the action in the composer's row, the
 * inputs control in BB's environment picker. A write has to reach all three,
 * and the same value has to outlive them — applying a project remounts every
 * plugin surface in the composer, and that is exactly when the pick was just
 * made. Hence the tab's storage underneath, read once and then kept, so the
 * snapshot stays the same object between renders.
 */
export const currentPick = (): ComposerPick | null => {
  if (picked || loaded) return picked;
  loaded = true;
  try {
    const raw = tabStorage()?.getItem(PICK_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<ComposerPick>) : null;
    picked =
      typeof value?.projectId === "string" &&
      typeof value?.hostId === "string" &&
      typeof value?.folderId === "string"
        ? (value as ComposerPick)
        : null;
  } catch {
    picked = null;
  }
  return picked;
};
export const subscribePick = (onChange: () => void) => {
  pickWatchers.add(onChange);
  return () => {
    pickWatchers.delete(onChange);
  };
};
export const recallPick = (projectId: string | null, hostId: string | null) => {
  const pick = currentPick();
  return pick && pick.projectId === projectId && pick.hostId === hostId
    ? pick.folderId
    : null;
};

/** A row of the chip menu: a project, one of its sections, or a group label. */
export type ChipEntry = {
  /** Null for a project BB knows and the plugin has no folder for. */
  folder: Folder | null;
  depth: number;
  projectId: string;
  projectName: string;
  kind: "project" | "section" | "group";
  /** BB's implicit project: choosing it means "don't work in a project". */
  personal?: boolean;
};

/** A project as BB's sidebar lists it. */
export type ChipProject = { id: string; name: string; isPersonal: boolean };

/**
 * Every project and every section under it, parents before children, with the
 * depth its indent needs. This is the tree BB's own project chip is missing:
 * it lists projects and stops there, so a chat started from the New thread
 * screen could only ever land in a project root.
 *
 * `projects` is BB's own list, and it decides which projects are offered and
 * in which order: replacing the chip must not hide a project the plugin has
 * no folder for, least of all BB's implicit "don't work in a project". The
 * plugin's tree only adds the sections underneath. Without that list the tree
 * speaks for itself.
 *
 * Sections of a project on another device belong to the same project and stay
 * in the list — the device is part of the section, not a separate project.
 */
export function chipEntries(
  tree: SectionTree,
  projects: readonly ChipProject[] = [],
): ChipEntry[] {
  const out: ChipEntry[] = [];
  const roots = tree.roots.filter(
    (r, i) => tree.roots.findIndex((x) => x.projectId === r.projectId) === i,
  );
  const sections = (projectId: string, name: string) => {
    const walk = (parentId: string | null, depth: number) => {
      for (const folder of tree.folders
        .filter(
          (f) => f.projectId === projectId && (f.parentId ?? null) === parentId,
        )
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
        out.push({
          folder,
          depth,
          projectId,
          projectName: name,
          kind: folder.kind === "group" ? "group" : "section",
        });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 1);
  };
  const listed = projects.length
    ? projects.map((p) => ({
        projectId: p.id,
        name: roots.find((r) => r.projectId === p.id)?.name ?? p.name,
        root: roots.find((r) => r.projectId === p.id) ?? null,
        personal: p.isPersonal,
      }))
    : [];
  for (const root of roots)
    if (!listed.some((p) => p.projectId === root.projectId))
      listed.push({
        projectId: root.projectId,
        name: root.name,
        root,
        personal: false,
      });
  for (const project of listed) {
    out.push({
      folder: project.root,
      depth: 0,
      projectId: project.projectId,
      projectName: project.name,
      kind: "project",
      ...(project.personal ? { personal: true } : {}),
    });
    if (project.root) sections(project.projectId, project.name);
  }
  return out;
}

/** What the chip says about the chosen place: "Project / Section / Subsection". */
export function placeLabel(tree: SectionTree, entry: ChipEntry): string {
  if (entry.kind === "project" || !entry.folder) return entry.projectName;
  const names: string[] = [];
  const seen = new Set<string>();
  for (
    let cur: Folder | undefined = entry.folder;
    cur && !seen.has(cur.id);
    cur = cur.parentId
      ? tree.folders.find((x) => x.id === cur!.parentId)
      : undefined
  ) {
    seen.add(cur.id);
    names.unshift(cur.name);
  }
  return [entry.projectName, ...names].join(" / ");
}
