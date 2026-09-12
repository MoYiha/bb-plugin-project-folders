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
function mount() {
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
        thread_move: () => ({ path: folder.path }),
      },
    },
  );
}
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
