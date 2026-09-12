import { describe, it, expect } from "vitest";
import {
  createFakePluginHost,
  makeThreadResponse,
} from "@get-bb/plugin-sdk/testing";
import plugin, { resolveFolderPath } from "./server";
const root = {
  id: "p1",
  name: "Test",
  sources: [
    { type: "local_path", hostId: "h1", path: "/work", isDefault: true },
  ],
};
async function setup() {
  const writes: Record<string, unknown>[] = [];
  const h = createFakePluginHost({
    pluginId: "project-folders",
    agentSkillIds: ["project-folders"],
    sdk: {
      projects: { list: async () => [root] as never },
      files: {
        mkdir: async (args) => {
          writes.push(args);
          return {} as never;
        },
        write: async (args) => {
          writes.push(args);
          return { outcome: "written", sha256: "sha", sizeBytes: 1 };
        },
      },
      environments: { list: async () => [] },
    },
  });
  await plugin(h.bb);
  return { ...h, writes };
}
describe("project folder boundaries", () => {
  it("accepts nested relative paths and rejects escapes or reserved directories", () => {
    expect(resolveFolderPath("/work", "Мои проекты/Selfy")).toBe(
      "/work/Мои проекты/Selfy",
    );
    for (const p of [
      "../secret",
      "/tmp",
      "a/../../x",
      ".",
      ".bb/chats",
      ".git/config",
      "a/../b",
      "a\u0000b",
    ])
      expect(() => resolveFolderPath("/work", p)).toThrow();
  });
  it("creates on the source host, persists hierarchy across reload, and rejects duplicates", async () => {
    const h = await setup();
    try {
      const a = (await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: null,
        name: "Projects",
        relativePath: "Projects",
      })) as { id: string };
      await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: a.id,
        name: "Selfy",
        relativePath: "Selfy",
      });
      expect(
        h.writes.some(
          (w) => w.hostId === "h1" && w.path === "/work/Projects/Selfy",
        ),
      ).toBe(true);
      Object.assign(h, await h.harness.lifecycle.reload(plugin));
      const result = (await h.harness.behavior.callRpc("list", null)) as {
        folders: unknown[];
      };
      expect(result.folders).toHaveLength(2);
      await expect(
        h.harness.behavior.callRpc("create", {
          projectId: "p1",
          folderId: null,
          name: "Duplicate",
          relativePath: "Projects",
        }),
      ).rejects.toThrow();
      await expect(
        h.harness.behavior.callRpc("create", {
          projectId: "wrong",
          folderId: a.id,
          name: "Escape",
          relativePath: "x",
        }),
      ).rejects.toThrow();
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
  it("does not overwrite concurrent edits to AGENTS.md", async () => {
    const h = await setup();
    try {
      h.harness.inspection.sdk.stub("files.write", async () => ({
        outcome: "conflict",
        currentSha256: "new",
      }));
      await expect(
        h.harness.behavior.callRpc("rules_save", {
          projectId: "p1",
          folderId: null,
          content: "rules",
          sha: "old",
        }),
      ).rejects.toThrow(/AGENTS/);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
  it("exports every timeline page to the section on the owning host", async () => {
    const h = await setup();
    try {
      h.harness.inspection.sdk.stub("threads.get", async () =>
        makeThreadResponse({ id: "t1", projectId: "p1", environmentId: "e1" }),
      );
      h.harness.inspection.sdk.stub("environments.get", async () => ({
        projectId: "p1",
        hostId: "h1",
        path: "/work",
      }));
      h.harness.inspection.sdk.stub("threads.timeline", async (args) => ({
        rows: [],
        timelinePage: {
          hasOlderRows: !args.beforeAnchorId,
          olderCursor: args.beforeAnchorId
            ? null
            : { anchorId: "r1", anchorSeq: 2 },
        },
      }));
      await h.harness.behavior.callRpc("sync", { threadId: "t1" });
      expect(
        h.writes.filter((w) => /\/history\/[^/]+\/page-/.test(String(w.path))),
      ).toHaveLength(2);
      expect(
        h.writes.every(
          (w) =>
            w.hostId === "h1" &&
            String(w.path).startsWith("/work/.bb/chats/t1/"),
        ),
      ).toBe(true);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
  it("uses the selected folder as cwd and preserves composer model and attachments", async () => {
    const h = await setup();
    try {
      const f = (await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: null,
        name: "Nested",
        relativePath: "nested",
      })) as { id: string };
      h.harness.inspection.sdk.stub("threads.spawn", async () =>
        makeThreadResponse({ id: "new-chat", projectId: "p1" }),
      );
      h.harness.inspection.sdk.stub("threads.get", async () =>
        makeThreadResponse({
          id: "new-chat",
          projectId: "p1",
          environmentId: null,
        }),
      );
      const request = {
        projectId: "p1",
        providerId: "codex",
        model: "selected-model",
        reasoningLevel: "medium",
        permissionMode: "full",
        environment: { type: "project-default" },
        executionInputSources: { model: "explicit" },
        input: [
          { type: "text", text: "hello" },
          { type: "localFile", path: "attachment.pdf" },
        ],
      };
      await h.harness.behavior.callRpc("spawn", {
        projectId: "p1",
        folderId: f.id,
        request,
      });
      const calls = h.harness.inspection.sdk.callsTo("threads.spawn");
      expect(JSON.stringify(calls)).toContain("/work/nested");
      expect(JSON.stringify(calls)).toContain("selected-model");
      expect(JSON.stringify(calls)).toContain("attachment.pdf");
      await expect(
        h.harness.behavior.callRpc("spawn", {
          projectId: "p1",
          folderId: f.id,
          request: { ...request, projectId: "wrong" },
        }),
      ).rejects.toThrow();
      await new Promise((r) => setTimeout(r, 0));
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
  it("routes section creation and browsing to the selected project source", async () => {
    const h = await setup();
    try {
      h.harness.inspection.sdk.stub("projects.list", async () => [
        {
          ...root,
          sources: [
            ...root.sources,
            {
              type: "local_path",
              hostId: "h2",
              path: "/macbook/projects",
              isDefault: false,
            },
          ],
        },
      ]);
      h.harness.inspection.sdk.stub("hosts.list", async () => [
        { id: "h1", name: "Mac Mini", status: "connected" },
        { id: "h2", name: "MacBook", status: "connected" },
      ]);
      h.harness.inspection.sdk.stub("hosts.directory", async (args) => ({
        directory: args.path,
        parent: null,
        entries: [],
      }));
      const locations = (await h.harness.behavior.callRpc("locations", {
        projectId: "p1",
        folderId: null,
      })) as {
        locations: { hostId: string; path: string; available: boolean }[];
      };
      expect(locations.locations.find((l) => l.hostId === "h2")).toMatchObject({
        available: true,
        path: "/macbook/projects",
      });
      const folder = (await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: null,
        hostId: "h2",
        name: "Work",
        relativePath: "Work",
      })) as { id: string };
      expect(
        h.writes.some(
          (w) => w.hostId === "h2" && w.path === "/macbook/projects/Work",
        ),
      ).toBe(true);
      await h.harness.behavior.callRpc("browse", {
        projectId: "p1",
        folderId: null,
        hostId: "h2",
        relative: "",
      });
      expect(
        JSON.stringify(h.harness.inspection.sdk.callsTo("hosts.directory")),
      ).toContain("/macbook/projects");
      await expect(
        h.harness.behavior.callRpc("create", {
          projectId: "p1",
          folderId: folder.id,
          hostId: "h1",
          name: "Wrong host",
          relativePath: "wrong",
        }),
      ).rejects.toThrow(/nested section/);
      await expect(
        h.harness.behavior.callRpc("create", {
          projectId: "p1",
          folderId: null,
          hostId: "unknown",
          name: "Wrong host",
          relativePath: "wrong",
        }),
      ).rejects.toThrow(/project source/);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
  it("creates a native BB project with an explicit machine and folder", async () => {
    const h = await setup();
    try {
      h.harness.inspection.sdk.stub("hosts.list", async () => [
        { id: "h2", name: "MacBook", status: "connected" },
      ]);
      h.harness.inspection.sdk.stub("projects.create", async () => ({
        id: "p2",
      }));
      await h.harness.behavior.callRpc("project_create", {
        hostId: "h2",
        name: "New project",
        path: "/macbook/new-project",
      });
      expect(
        h.writes.some(
          (w) => w.hostId === "h2" && w.path === "/macbook/new-project",
        ),
      ).toBe(true);
      expect(
        JSON.stringify(h.harness.inspection.sdk.callsTo("projects.create")),
      ).toContain("local_path");
      await expect(
        h.harness.behavior.callRpc("project_create", {
          hostId: "offline",
          name: "No",
          path: "/tmp/no",
        }),
      ).rejects.toThrow(/offline/);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
});
