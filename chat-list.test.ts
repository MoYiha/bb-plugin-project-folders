import { describe, it, expect } from "vitest";
import {
  sortChats,
  parseSettings,
  parseCollapseState,
  getThreadActivity,
  isThreadBusy,
  collectFolderThreads,
  isSectionInactive,
  isSectionCollapsed,
  INACTIVE_SECTION_THRESHOLD_MS,
} from "./chat-list";
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
      autoCollapseInactive: true,
    });
    expect(
      parseSettings('{"sort":"activity","limit":10,"autoCollapseInactive":false}'),
    ).toEqual({
      sort: "activity",
      limit: 10,
      autoCollapseInactive: false,
    });
  });
});

describe("auto-collapsing inactive sections", () => {
  const folders = [
    { id: "sec1", projectId: "p1", parentId: null },
    { id: "sub1", projectId: "p1", parentId: "sec1" },
  ];
  const bindings = {
    env1: "sec1",
    env2: "sub1",
  };

  it("parses collapse state from both legacy boolean and timestamped formats", () => {
    expect(parseCollapseState(null)).toEqual({});
    expect(parseCollapseState("invalid")).toEqual({});
    expect(parseCollapseState(JSON.stringify({ sec1: true, sec2: false }))).toEqual({
      sec1: { collapsed: true, at: 0 },
      sec2: { collapsed: false, at: 0 },
    });
    expect(
      parseCollapseState(
        JSON.stringify({
          sec1: { collapsed: true, at: 1000 },
          sec2: { collapsed: false, at: 2000 },
        }),
      ),
    ).toEqual({
      sec1: { collapsed: true, at: 1000 },
      sec2: { collapsed: false, at: 2000 },
    });
  });

  it("calculates thread activity from updatedAt, latestAttentionAt, and createdAt", () => {
    expect(getThreadActivity({ createdAt: 10 })).toBe(10);
    expect(getThreadActivity({ createdAt: 10, updatedAt: 20 })).toBe(20);
    expect(
      getThreadActivity({ createdAt: 10, updatedAt: 20, latestAttentionAt: 30 }),
    ).toBe(30);
    // When thread is simply read, updatedAt matches lastReadAt and does not count as conversation activity
    expect(
      getThreadActivity({
        createdAt: 10,
        latestAttentionAt: 25,
        updatedAt: 1000,
        lastReadAt: 1000,
      }),
    ).toBe(25);
  });

  it("identifies busy threads", () => {
    expect(isThreadBusy({})).toBe(false);
    expect(isThreadBusy({ indicator: "running" })).toBe(true);
    expect(isThreadBusy({ indicator: "workflow" })).toBe(true);
    expect(isThreadBusy({ status: "active" })).toBe(true);
    expect(isThreadBusy({ hasPendingInteraction: true })).toBe(true);
    expect(isThreadBusy({ activity: { workflows: 1 } })).toBe(true);
    expect(isThreadBusy({ activity: { backgroundAgents: 1 } })).toBe(true);
    expect(isThreadBusy({ activity: { backgroundCommands: 1 } })).toBe(true);
  });

  it("collects threads including child subsections", () => {
    const threads = [
      { id: "t1", projectId: "p1", environment: { id: "env1" } },
      { id: "t2", projectId: "p1", environment: { id: "env2" } },
      { id: "t3", projectId: "p2", environment: { id: "other" } },
    ];
    const sec1Threads = collectFolderThreads(
      "sec1",
      "p1",
      folders,
      bindings,
      threads,
    );
    expect(sec1Threads.map((t) => t.id)).toEqual(["t1", "t2"]);

    const sub1Threads = collectFolderThreads(
      "sub1",
      "p1",
      folders,
      bindings,
      threads,
    );
    expect(sub1Threads.map((t) => t.id)).toEqual(["t2"]);
  });

  it("marks a section as inactive when chats are older than 2 hours", () => {
    const now = 10_000_000;
    const oldTime = now - 3 * 60 * 60 * 1000; // 3 hours ago
    const freshTime = now - 30 * 60 * 1000; // 30 minutes ago

    // Section with old chats -> inactive
    expect(
      isSectionInactive({
        folderId: "sec1",
        projectId: "p1",
        folders,
        bindings,
        threads: [
          {
            id: "t1",
            projectId: "p1",
            environment: { id: "env1" },
            updatedAt: oldTime,
          },
        ],
        now,
      }),
    ).toBe(true);

    // Section with recent chat -> active
    expect(
      isSectionInactive({
        folderId: "sec1",
        projectId: "p1",
        folders,
        bindings,
        threads: [
          {
            id: "t1",
            projectId: "p1",
            environment: { id: "env1" },
            updatedAt: freshTime,
          },
        ],
        now,
      }),
    ).toBe(false);

    // Empty section -> not inactive (no clutter)
    expect(
      isSectionInactive({
        folderId: "sec1",
        projectId: "p1",
        folders,
        bindings,
        threads: [],
        now,
      }),
    ).toBe(false);

    // Active thread open in UI -> not inactive
    expect(
      isSectionInactive({
        folderId: "sec1",
        projectId: "p1",
        folders,
        bindings,
        threads: [
          {
            id: "t1",
            projectId: "p1",
            environment: { id: "env1" },
            updatedAt: oldTime,
          },
        ],
        activeThreadId: "t1",
        now,
      }),
    ).toBe(false);

    // Running background task -> not inactive
    expect(
      isSectionInactive({
        folderId: "sec1",
        projectId: "p1",
        folders,
        bindings,
        threads: [
          {
            id: "t1",
            projectId: "p1",
            environment: { id: "env1" },
            updatedAt: oldTime,
            indicator: "running",
          },
        ],
        now,
      }),
    ).toBe(false);

    // Activity in subsection prevents parent from becoming inactive
    expect(
      isSectionInactive({
        folderId: "sec1",
        projectId: "p1",
        folders,
        bindings,
        threads: [
          {
            id: "t1",
            projectId: "p1",
            environment: { id: "env1" },
            updatedAt: oldTime,
          },
          {
            id: "t2",
            projectId: "p1",
            environment: { id: "env2" },
            updatedAt: freshTime,
          },
        ],
        now,
      }),
    ).toBe(false);
  });

  it("determines section collapsed state with auto-collapse and manual overrides", () => {
    const now = 20_000_000;
    const oldTime = now - 3 * 60 * 60 * 1000; // 3 hours ago
    const freshTime = now - 15 * 60 * 1000; // 15 mins ago
    const oldThreads = [
      {
        id: "t1",
        projectId: "p1",
        environment: { id: "env1" },
        updatedAt: oldTime,
      },
    ];
    const freshThreads = [
      {
        id: "t1",
        projectId: "p1",
        environment: { id: "env1" },
        updatedAt: freshTime,
      },
    ];

    // Root project folder is never auto-collapsed
    expect(
      isSectionCollapsed({
        folderId: "sec1",
        projectId: "p1",
        root: true,
        folders,
        bindings,
        threads: oldThreads,
        now,
      }),
    ).toBe(false);

    // Section with old chats is auto-collapsed by default
    expect(
      isSectionCollapsed({
        folderId: "sec1",
        projectId: "p1",
        root: false,
        folders,
        bindings,
        threads: oldThreads,
        now,
      }),
    ).toBe(true);

    // Section with fresh chats is expanded
    expect(
      isSectionCollapsed({
        folderId: "sec1",
        projectId: "p1",
        root: false,
        folders,
        bindings,
        threads: freshThreads,
        now,
      }),
    ).toBe(false);

    // If user manually expanded an inactive section recently (< 2 hours), it stays open
    expect(
      isSectionCollapsed({
        folderId: "sec1",
        projectId: "p1",
        root: false,
        folders,
        bindings,
        threads: oldThreads,
        record: { collapsed: false, at: now - 30 * 60 * 1000 },
        now,
      }),
    ).toBe(false);

    // If user manual expand happened > 2 hours ago with no new activity, it auto-collapses again
    expect(
      isSectionCollapsed({
        folderId: "sec1",
        projectId: "p1",
        root: false,
        folders,
        bindings,
        threads: oldThreads,
        record: { collapsed: false, at: now - 3 * 60 * 60 * 1000 },
        now,
      }),
    ).toBe(true);

    // If new activity arrives after manual collapse, section opens
    expect(
      isSectionCollapsed({
        folderId: "sec1",
        projectId: "p1",
        root: false,
        folders,
        bindings,
        threads: [
          {
            id: "t1",
            projectId: "p1",
            environment: { id: "env1" },
            updatedAt: now - 5 * 60 * 1000,
          },
        ],
        record: { collapsed: true, at: now - 10 * 60 * 1000 },
        now,
      }),
    ).toBe(false);

    // When autoCollapseInactive is false, old chats do not auto-collapse
    expect(
      isSectionCollapsed({
        folderId: "sec1",
        projectId: "p1",
        root: false,
        folders,
        bindings,
        threads: oldThreads,
        autoCollapseInactive: false,
        now,
      }),
    ).toBe(false);
  });
});
