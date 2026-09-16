export type ChatSort = "activity" | "title" | "created";
export type ChatListSettings = {
  sort: ChatSort;
  limit: number;
  autoCollapseInactive: boolean;
};
export const defaults: ChatListSettings = {
  sort: "activity",
  limit: 10,
  autoCollapseInactive: true,
};
export const INACTIVE_SECTION_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export function parseSettings(raw: string | null): ChatListSettings {
  try {
    const value = JSON.parse(raw || "{}");
    return {
      sort: ["activity", "title", "created"].includes(value.sort)
        ? value.sort
        : defaults.sort,
      limit:
        Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 100
          ? value.limit
          : defaults.limit,
      autoCollapseInactive:
        typeof value.autoCollapseInactive === "boolean"
          ? value.autoCollapseInactive
          : defaults.autoCollapseInactive,
    };
  } catch {
    return defaults;
  }
}
type Chat = {
  id: string;
  title: string | null;
  titleFallback: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
  latestAttentionAt: number;
};
export function sortChats<T extends Chat>(
  chats: readonly T[],
  sort: ChatSort,
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  });
  return chats
    .filter((c) => !c.isArchived)
    .sort((a, b) => {
      const pinned = Number(b.isPinned) - Number(a.isPinned);
      if (pinned) return pinned;
      const primary =
        sort === "title"
          ? collator.compare(
              a.title || a.titleFallback || "",
              b.title || b.titleFallback || "",
            )
          : sort === "created"
            ? b.createdAt - a.createdAt
            : Math.max(b.updatedAt, b.latestAttentionAt, b.createdAt) -
              Math.max(a.updatedAt, a.latestAttentionAt, a.createdAt);
      return primary || a.id.localeCompare(b.id);
    });
}

export type ChatThread = {
  id: string;
  projectId: string;
  environment?: { id: string | null } | null;
  createdAt?: number;
  updatedAt?: number;
  lastReadAt?: number | null;
  latestAttentionAt?: number;
  indicator?: string;
  hasPendingInteraction?: boolean;
  isUnread?: boolean;
  isArchived?: boolean;
  status?: string;
  activity?: {
    workflows?: number;
    backgroundAgents?: number;
    backgroundCommands?: number;
    planMode?: number;
    goals?: number;
  };
};

export type CollapseRecord = {
  collapsed: boolean;
  at: number;
};

export function parseCollapseState(
  raw: string | null,
): Record<string, CollapseRecord> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const result: Record<string, CollapseRecord> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "boolean") {
        result[k] = { collapsed: v, at: 0 };
      } else if (
        v &&
        typeof v === "object" &&
        typeof (v as { collapsed?: unknown }).collapsed === "boolean"
      ) {
        result[k] = {
          collapsed: (v as { collapsed: boolean }).collapsed,
          at:
            typeof (v as { at?: unknown }).at === "number"
              ? (v as { at: number }).at
              : 0,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function getThreadActivity(thread: {
  updatedAt?: number;
  latestAttentionAt?: number;
  createdAt?: number;
  lastReadAt?: number | null;
}): number {
  // BB sets updatedAt = lastReadAt = Date.now() whenever a thread is opened/read.
  // To detect actual conversation activity (messages, turns, attention), ignore updatedAt
  // if it only reflects reading the thread without new messages.
  const isOnlyRead =
    thread.updatedAt &&
    thread.lastReadAt &&
    Math.abs(thread.updatedAt - thread.lastReadAt) < 2000;
  const effectiveUpdatedAt = isOnlyRead ? 0 : (thread.updatedAt ?? 0);

  return Math.max(
    effectiveUpdatedAt,
    thread.latestAttentionAt ?? 0,
    thread.createdAt ?? 0,
  );
}

export function isThreadBusy(thread: {
  indicator?: string;
  hasPendingInteraction?: boolean;
  status?: string;
  activity?: {
    workflows?: number;
    backgroundAgents?: number;
    backgroundCommands?: number;
  };
}): boolean {
  if (thread.status === "active") return true;
  if (thread.indicator && thread.indicator !== "none") return true;
  if (thread.hasPendingInteraction) return true;
  if (thread.activity) {
    if ((thread.activity.workflows ?? 0) > 0) return true;
    if ((thread.activity.backgroundAgents ?? 0) > 0) return true;
    if ((thread.activity.backgroundCommands ?? 0) > 0) return true;
  }
  return false;
}

export function collectSubtreeFolderIds(
  folderId: string,
  projectId: string,
  folders: readonly { id: string; projectId: string; parentId: string | null }[],
): Set<string> {
  const ids = new Set<string>([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of folders) {
      if (
        f.projectId === projectId &&
        f.parentId &&
        ids.has(f.parentId) &&
        !ids.has(f.id)
      ) {
        ids.add(f.id);
        added = true;
      }
    }
  }
  return ids;
}

export function collectFolderThreads<T extends ChatThread>(
  folderId: string,
  projectId: string,
  folders: readonly { id: string; projectId: string; parentId: string | null }[],
  bindings: Record<string, string>,
  threads: readonly T[],
): T[] {
  const folderIds = collectSubtreeFolderIds(folderId, projectId, folders);
  return threads.filter(
    (t) =>
      t.projectId === projectId &&
      folderIds.has(bindings[t.environment?.id ?? ""] ?? ""),
  );
}

export function isSectionInactive<T extends ChatThread>(params: {
  folderId: string;
  projectId: string;
  folders: readonly { id: string; projectId: string; parentId: string | null }[];
  bindings: Record<string, string>;
  threads: readonly T[];
  activeThreadId?: string | null;
  thresholdMs?: number;
  now?: number;
}): boolean {
  const {
    folderId,
    projectId,
    folders,
    bindings,
    threads,
    activeThreadId,
    thresholdMs = INACTIVE_SECTION_THRESHOLD_MS,
    now = Date.now(),
  } = params;

  const sectionThreads = collectFolderThreads(
    folderId,
    projectId,
    folders,
    bindings,
    threads,
  );

  if (sectionThreads.length === 0) return false;
  if (activeThreadId && sectionThreads.some((t) => t.id === activeThreadId)) {
    return false;
  }
  if (sectionThreads.some(isThreadBusy)) {
    return false;
  }

  const latestActivity = Math.max(...sectionThreads.map(getThreadActivity));
  if (latestActivity <= 0) return true;

  return now - latestActivity > thresholdMs;
}

export function isSectionCollapsed<T extends ChatThread>(params: {
  folderId: string;
  projectId: string;
  root: boolean;
  folders: readonly { id: string; projectId: string; parentId: string | null }[];
  bindings: Record<string, string>;
  threads: readonly T[];
  record?: CollapseRecord;
  activeThreadId?: string | null;
  autoCollapseInactive?: boolean;
  thresholdMs?: number;
  now?: number;
}): boolean {
  const {
    folderId,
    projectId,
    root,
    folders,
    bindings,
    threads,
    record,
    activeThreadId,
    autoCollapseInactive = true,
    thresholdMs = INACTIVE_SECTION_THRESHOLD_MS,
    now = Date.now(),
  } = params;

  if (record?.collapsed) {
    return true;
  }

  if (root) {
    return false;
  }

  if (!autoCollapseInactive) {
    return false;
  }

  const sectionThreads = collectFolderThreads(
    folderId,
    projectId,
    folders,
    bindings,
    threads,
  );

  if (record && !record.collapsed && record.at > 0) {
    if (now - record.at < thresholdMs) {
      return false;
    }
  }

  if (activeThreadId && sectionThreads.some((t) => t.id === activeThreadId)) {
    return false;
  }

  if (sectionThreads.some(isThreadBusy)) {
    return false;
  }

  const hasChats = sectionThreads.length > 0;
  const latestActivity = hasChats
    ? Math.max(...sectionThreads.map(getThreadActivity))
    : 0;

  if (hasChats && (latestActivity <= 0 || now - latestActivity > thresholdMs)) {
    return true;
  }

  return false;
}

export function hasFolderUnread<T extends ChatThread>(params: {
  folderId: string;
  projectId: string;
  root: boolean;
  folders: readonly { id: string; projectId: string; parentId: string | null }[];
  bindings: Record<string, string>;
  threads: readonly T[];
}): boolean {
  const { folderId, projectId, root, folders, bindings, threads } = params;
  if (root) {
    return threads.some(
      (t) => t.projectId === projectId && !t.isArchived && !!t.isUnread,
    );
  }
  const sectionThreads = collectFolderThreads(
    folderId,
    projectId,
    folders,
    bindings,
    threads,
  );
  return sectionThreads.some((t) => !t.isArchived && !!t.isUnread);
}
