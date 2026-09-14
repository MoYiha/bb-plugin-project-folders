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
afterEach(cleanup);
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
        thread_move: () => {
          if (failMove)
            throw new Error(
              "Wait for the chat and its queued messages to finish before moving it.",
            );
          return { path: folder.path };
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
it("drops a chat onto a section through the same relocation RPC", async () => {
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
      view.inspection.rpcCalls.some((call) => call.method === "thread_move"),
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
  expect(view.inspection.rpcCalls.some((c) => c.method === "thread_move")).toBe(
    false,
  );
  fireEvent.click(
    await view.findByRole("button", { name: "Move", exact: true }),
  );
  await waitFor(() =>
    expect(
      view.inspection.rpcCalls.some((c) => c.method === "thread_move"),
    ).toBe(true),
  );
  view.lifecycle.unmount();
});
