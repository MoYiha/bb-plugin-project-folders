// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it } from "vitest";
import { fireEvent, waitFor, cleanup } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
let app: Awaited<ReturnType<typeof loadPluginApp>>;
beforeAll(async () => {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  app = await loadPluginApp(() => import("./app"));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const thread: PluginSidebarThread = {
  id: "t1",
  projectId: "p1",
  title: "Example chat",
  titleFallback: null,
  parentThreadId: null,
  sectionId: null,
  originKind: null,
  originPluginId: null,
  providerId: "codex",
  hasPendingInteraction: false,
  activity: {
    workflows: 0,
    backgroundAgents: 0,
    backgroundCommands: 0,
    planMode: 0,
    goals: 0,
  },
  indicator: "none",
  indicatorLabel: null,
  isUnread: false,
  isPinned: false,
  isArchived: false,
  environment: {
    id: "e1",
    name: null,
    branchName: null,
    providerId: null,
    workspaceDisplayKind: null,
  },
  host: { id: "h1", name: "Mini" },
  createdAt: 1,
  updatedAt: 1,
  lastReadAt: 1,
  latestAttentionAt: 1,
};
const root = {
  id: "p1",
  projectId: "p1",
  hostId: "h1",
  parentId: null,
  path: "/work",
  name: "Project",
};
const folder = { ...root, id: "f1", path: "/work/Section", name: "Section" };
function mount(failMove = false) {
  return renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [thread], projects: [] },
      rpc: {
        list: () => ({
          folders: [folder],
          roots: [root],
          bindings: {},
          errors: [],
        }),
        thread_place: () => {
          if (failMove) throw new Error("Section not found.");
          return { ok: true };
        },
      },
    },
  );
}
it("opens the project menu on right-click with the same actions as the ellipsis", async () => {
  const view = mount();
  fireEvent.contextMenu(await view.findByText("Project"));
  expect(
    await view.findByRole("menuitem", { name: /New section/ }),
  ).toBeTruthy();
  expect(view.getByRole("menuitem", { name: /New project/ })).toBeTruthy();
  expect(view.getByRole("menuitem", { name: /^Delete$/ })).toBeTruthy();
  expect(view.queryByRole("menuitem", { name: /^Archive$/ })).toBeNull();
  view.lifecycle.unmount();
});
it("sends new chats on a project to the plugin composer with the section tree", async () => {
  const view = mount();
  fireEvent.click(
    await view.findByRole("button", { name: "New chat: Project" }),
  );
  expect(
    view.inspection.navigateCalls.some(
      (c) =>
        c.method === "toPluginPanel" &&
        JSON.stringify(c).includes("chat/p1/root:h1"),
    ),
  ).toBe(true);
  expect(
    view.inspection.sidebarActionCalls.some((c) =>
      JSON.stringify(c).includes("openNewThread"),
    ),
  ).toBe(false);
  view.lifecycle.unmount();
});
it("opens the section menu on right-click with archive instead of delete", async () => {
  const view = mount();
  fireEvent.contextMenu(await view.findByText("Section"));
  expect(
    await view.findByRole("menuitem", { name: /New section/ }),
  ).toBeTruthy();
  expect(view.getByRole("menuitem", { name: /^Archive$/ })).toBeTruthy();
  expect(view.queryByRole("menuitem", { name: /New project/ })).toBeNull();
  expect(view.queryByRole("menuitem", { name: /^Delete$/ })).toBeNull();
  view.lifecycle.unmount();
});
it("opens the chat action menu on right-click and offers native actions plus move", async () => {
  const view = mount();
  fireEvent.contextMenu(await view.findByText("Example chat"));
  expect(await view.findByText("Move to section…")).toBeTruthy();
  expect(await view.findByText("Pin")).toBeTruthy();
  view.lifecycle.unmount();
});
it("drops a chat onto a section through the filing RPC", async () => {
  const view = mount();
  const chat = (await view.findByText("Example chat")).closest(".pf-thread")!;
  const target = (await view.findByText("Section")).closest(".pf-heading")!;
  const data = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: "",
    dropEffect: "",
    setData: (k: string, v: string) => data.set(k, v),
    getData: (k: string) => data.get(k) || "",
  };
  fireEvent.dragStart(chat, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  await waitFor(() =>
    expect(
      view.inspection.rpcCalls.some((call) => call.method === "thread_place"),
    ).toBe(true),
  );
  view.lifecycle.unmount();
});
it("offers inline rename from the context menu and supports Escape", async () => {
  const view = mount();
  fireEvent.contextMenu(await view.findByText("Example chat"));
  fireEvent.click(await view.findByText("Rename"));
  const input = await view.findByRole("textbox", { name: "Rename" });
  expect((input as HTMLInputElement).value).toBe("Example chat");
  fireEvent.change(input, { target: { value: "Changed" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(await view.findByText("Example chat")).toBeTruthy();
  view.lifecycle.unmount();
});
it("starts inline rename on double-click", async () => {
  const view = mount();
  fireEvent.doubleClick(await view.findByText("Example chat"));
  expect(await view.findByRole("textbox", { name: "Rename" })).toBeTruthy();
  view.lifecycle.unmount();
});
it("saves a renamed title through the native BB action", async () => {
  const view = mount();
  fireEvent.doubleClick(await view.findByText("Example chat"));
  const input = await view.findByRole("textbox", { name: "Rename" });
  fireEvent.change(input, { target: { value: "Updated title" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() =>
    expect(JSON.stringify(view.inspection.sidebarActionCalls)).toContain(
      "Updated title",
    ),
  );
  expect(JSON.stringify(view.inspection.sidebarActionCalls)).toContain(
    "rename",
  );
  view.lifecycle.unmount();
});
it("reports a rejected drop without opening the destination dialog", async () => {
  const view = mount(true);
  const chat = (await view.findByText("Example chat")).closest(".pf-thread")!;
  const target = (await view.findByText("Section")).closest(".pf-heading")!;
  const values = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: "",
    dropEffect: "",
    setData: (k: string, v: string) => values.set(k, v),
    getData: (k: string) => values.get(k) || "",
  };
  fireEvent.dragStart(chat, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  expect(await view.findByRole("alert")).toBeTruthy();
  expect(view.queryByRole("dialog")).toBeNull();
  view.lifecycle.unmount();
});
it("selects a destination before explicitly moving from the menu", async () => {
  const view = mount();
  fireEvent.contextMenu(await view.findByText("Example chat"));
  fireEvent.click(await view.findByText("Move to section…"));
  const dialog = await view.findByRole("dialog");
  const section = Array.from(dialog.querySelectorAll("button")).find(
    (b) => b.textContent === "Section",
  )!;
  fireEvent.click(section);
  expect(
    view.inspection.rpcCalls.some((c) => c.method === "thread_place"),
  ).toBe(false);
  fireEvent.click(
    await view.findByRole("button", { name: "Move", exact: true }),
  );
  await waitFor(() =>
    expect(
      view.inspection.rpcCalls.some((c) => c.method === "thread_place"),
    ).toBe(true),
  );
  view.lifecycle.unmount();
});
it("auto-collapses section when chats have been inactive for over 2 hours and expands on toggle", async () => {
  const oldThread: PluginSidebarThread = {
    ...thread,
    id: "old-t1",
    title: "Inactive chat",
    updatedAt: Date.now() - 3 * 60 * 60 * 1000,
    latestAttentionAt: Date.now() - 3 * 60 * 60 * 1000,
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    environment: {
      id: "env-sec",
      name: null,
      branchName: null,
      providerId: null,
      workspaceDisplayKind: null,
    },
  };
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [oldThread], projects: [] },
      rpc: {
        list: () => ({
          folders: [folder],
          roots: [root],
          bindings: { "env-sec": folder.id },
          errors: [],
        }),
      },
    },
  );

  expect(await view.findByText("Section")).toBeTruthy();
  expect(view.queryByText("Inactive chat")).toBeNull();

  fireEvent.click(view.getByText("Section"));
  expect(await view.findByText("Inactive chat")).toBeTruthy();

  view.lifecycle.unmount();
});
it("allows manual collapse even when active thread is inside the section", async () => {
  const activeThread: PluginSidebarThread = {
    ...thread,
    id: "active-t1",
    title: "Working chat",
    environment: {
      id: "env-sec",
      name: null,
      branchName: null,
      providerId: null,
      workspaceDisplayKind: null,
    },
  };
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: "active-t1", onNavigate() {} },
    {
      sidebarThreads: { threads: [activeThread], projects: [] },
      rpc: {
        list: () => ({
          folders: [folder],
          roots: [root],
          bindings: { "env-sec": folder.id },
          errors: [],
        }),
      },
    },
  );

  expect(await view.findByText("Working chat")).toBeTruthy();

  // User clicks to collapse section
  fireEvent.click(view.getByText("Section"));
  await waitFor(() => {
    expect(view.queryByText("Working chat")).toBeNull();
  });

  view.lifecycle.unmount();
});
it("styles section and project labels as bold/unread when there is an unread chat", async () => {
  const unreadThread: PluginSidebarThread = {
    ...thread,
    id: "unread-t1",
    title: "Unread chat",
    isUnread: true,
    environment: {
      id: "env-sec",
      name: null,
      branchName: null,
      providerId: null,
      workspaceDisplayKind: null,
    },
  };
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [unreadThread], projects: [] },
      rpc: {
        list: () => ({
          folders: [folder],
          roots: [root],
          bindings: { "env-sec": folder.id },
          errors: [],
        }),
      },
    },
  );

  const sectionBtn = (await view.findByText("Section")).closest("button")!;
  expect(sectionBtn.className).toContain("pf-unread");

  const projectBtn = (await view.findByText("Project")).closest("button")!;
  expect(projectBtn.className).toContain("pf-unread");

  view.lifecycle.unmount();
});
it("files a chat from a section on another device into any section of its project", async () => {
  const remoteRoot = { ...root, hostId: "h2", path: "/srv/work" };
  const group = {
    ...folder,
    id: "g1",
    parentId: folder.id,
    name: "Group",
    path: "@group/g1",
    kind: "group",
  };
  const remote = {
    ...folder,
    id: "f2",
    hostId: "h2",
    parentId: group.id,
    name: "Remote",
    path: "/srv/sites/remote",
  };
  const remoteChat: PluginSidebarThread = {
    ...thread,
    id: "t2",
    title: "Remote chat",
    host: { id: "h2", name: "Hub" },
    updatedAt: Date.now(),
    latestAttentionAt: Date.now(),
    environment: {
      id: "env-remote",
      name: null,
      branchName: null,
      providerId: null,
      workspaceDisplayKind: null,
    },
  };
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [remoteChat], projects: [] },
      rpc: {
        list: () => ({
          folders: [folder, group, remote],
          roots: [root, remoteRoot],
          bindings: { "env-remote": remote.id },
          places: {},
          errors: [],
          machines: [
            { id: "h1", name: "Mini", connected: true },
            { id: "h2", name: "Hub", connected: true },
          ],
        }),
        thread_place: () => ({ ok: true }),
      },
    },
  );
  fireEvent.contextMenu(await view.findByText("Remote chat"));
  fireEvent.click(await view.findByText("Move to section…"));
  const dialog = await view.findByRole("dialog");
  const row = (name: string) =>
    Array.from(dialog.querySelectorAll("button.pf-move-target")).find((b) =>
      b.querySelector("span")?.textContent?.includes(name),
    ) as HTMLButtonElement;
  // The project appears once, with its whole tree under it.
  expect(
    Array.from(dialog.querySelectorAll("button.pf-move-target")).filter((b) =>
      b.querySelector("span")?.textContent?.includes("Project"),
    ),
  ).toHaveLength(1);
  expect(row("Remote").textContent).toContain("Currently here");
  // A section on the other device takes the chat: only the tree place changes.
  expect(row("Section").disabled).toBe(false);
  // A group holds sections, not chats.
  expect(row("Group").disabled).toBe(true);
  fireEvent.click(row("Section"));
  fireEvent.click(
    await view.findByRole("button", { name: "Move", exact: true }),
  );
  await waitFor(() =>
    expect(
      view.inspection.rpcCalls.some(
        (c) =>
          c.method === "thread_place" &&
          JSON.stringify(c.input) ===
            JSON.stringify({
              threadId: "t2",
              projectId: "p1",
              folderId: "f1",
            }),
      ),
    ).toBe(true),
  );
  view.lifecycle.unmount();
});
it("shows where a filed chat works and offers to file it back", async () => {
  const other = { ...folder, id: "f2", path: "/work/Other", name: "Other" };
  const filed: PluginSidebarThread = {
    ...thread,
    id: "t3",
    title: "Filed chat",
    updatedAt: Date.now(),
    latestAttentionAt: Date.now(),
    environment: {
      id: "env-sec",
      name: null,
      branchName: null,
      providerId: null,
      workspaceDisplayKind: null,
    },
  };
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [filed], projects: [] },
      rpc: {
        list: () => ({
          folders: [folder, other],
          roots: [root],
          bindings: { "env-sec": folder.id },
          places: { t3: other.id },
          errors: [],
          machines: [{ id: "h1", name: "Mini", connected: true }],
        }),
        thread_place_clear: () => ({ ok: true }),
      },
    },
  );
  const row = (await view.findByText("Filed chat")).closest(".pf-thread")!;
  // The chat is listed under Other, and says it still works in Section.
  expect(row.textContent).toContain("Section");
  fireEvent.contextMenu(await view.findByText("Filed chat"));
  fireEvent.click(await view.findByText("File back where it works"));
  await waitFor(() =>
    expect(
      view.inspection.rpcCalls.some((c) => c.method === "thread_place_clear"),
    ).toBe(true),
  );
  view.lifecycle.unmount();
});
it("explains a drop on a group, which holds sections and not chats", async () => {
  const group = {
    ...folder,
    id: "g1",
    parentId: null,
    name: "Group",
    path: "@group/g1",
    kind: "group",
  };
  const view = renderSlot(
    app.threadLists[0]!,
    { activeThreadId: null, onNavigate() {} },
    {
      sidebarThreads: { threads: [thread], projects: [] },
      rpc: {
        list: () => ({
          folders: [folder, group],
          roots: [root],
          bindings: {},
          places: {},
          errors: [],
          machines: [{ id: "h1", name: "Mini", connected: true }],
        }),
      },
    },
  );
  const chat = (await view.findByText("Example chat")).closest(".pf-thread")!;
  const target = (await view.findByText("Group")).closest(".pf-heading")!;
  const values = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: "",
    dropEffect: "",
    setData: (k: string, v: string) => values.set(k, v),
    getData: (k: string) => values.get(k) || "",
  };
  fireEvent.dragStart(chat, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  expect(target.className).toContain("pf-drop-refused");
  fireEvent.drop(target, { dataTransfer });
  const alert = await view.findByRole("alert");
  expect(alert.textContent).toContain("A group has no folder of its own");
  expect(
    view.inspection.rpcCalls.some((c) => c.method === "thread_place"),
  ).toBe(false);
  view.lifecycle.unmount();
});
