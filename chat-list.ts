export type ChatSort = "activity" | "title" | "created";
export type ChatListSettings = { sort: ChatSort; limit: number };
export const defaults: ChatListSettings = { sort: "activity", limit: 10 };
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
