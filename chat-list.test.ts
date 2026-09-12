import { describe, it, expect } from "vitest";
import { sortChats, parseSettings } from "./chat-list";
const chat = (id: string, overrides = {}) => ({
  id,
  title: id,
  titleFallback: null,
  isPinned: false,
  isArchived: false,
  createdAt: 1,
  updatedAt: 1,
  latestAttentionAt: 1,
  ...overrides,
});
describe("chat list order", () => {
  it("promotes a chat when a new update or attention event arrives", () => {
    const initial = [chat("older"), chat("newer", { updatedAt: 4 })];
    expect(sortChats(initial, "activity", "en").map((x) => x.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(
      sortChats(
        [chat("older", { latestAttentionAt: 5 }), initial[1]],
        "activity",
        "en",
      ).map((x) => x.id),
    ).toEqual(["older", "newer"]);
    expect(
      sortChats(
        [chat("older", { updatedAt: 6 }), initial[1]],
        "activity",
        "en",
      )[0].id,
    ).toBe("older");
    expect(initial[0].id).toBe("older");
  });
  it("excludes archives and keeps pinned chats above newer activity", () => {
    expect(
      sortChats(
        [
          chat("busy", { updatedAt: 99 }),
          chat("pin", { isPinned: true }),
          chat("hidden", { isArchived: true }),
        ],
        "activity",
        "en",
      ).map((x) => x.id),
    ).toEqual(["pin", "busy"]);
  });
  it("sorts names naturally and supports newest-created order", () => {
    const rows = [
      chat("10", { title: "Task 10", createdAt: 2 }),
      chat("2", { title: "Task 2", createdAt: 3 }),
    ];
    expect(sortChats(rows, "title", "en")[0].id).toBe("2");
    expect(sortChats(rows, "created", "en")[0].id).toBe("2");
  });
  it("validates persisted preferences", () => {
    for (const raw of [
      "null",
      "broken",
      '{"limit":0}',
      '{"limit":101}',
      '{"limit":2.5}',
    ])
      expect(parseSettings(raw).limit).toBe(10);
    expect(parseSettings('{"sort":"title","limit":5}')).toEqual({
      sort: "title",
      limit: 5,
    });
  });
});
