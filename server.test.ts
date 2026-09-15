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
      hosts: {
        list: async () =>
          [{ id: "h1", name: "Mac", status: "connected" }] as never,
      },
      files: {
        mkdir: async (args) => {
          writes.push(args);
          return {} as never;
        },
        read: async () => {
          throw new Error("ENOENT: no such file or directory");
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
      await h.harness.behavior.callRpc("spawn", {
        projectId: "p1",
        folderId: f.id,
        request: {
          ...request,
          environment: {
            type: "provider",
            environmentProviderId: "project-checkout",
            machine: { type: "existing", hostId: "h1" },
            inputs: { path: "/work/nested" },
          },
        },
      });
      await expect(
        h.harness.behavior.callRpc("spawn", {
          projectId: "p1",
          folderId: f.id,
          request: {
            ...request,
            environment: {
              type: "provider",
              environmentProviderId: "project-checkout",
              machine: { type: "existing", hostId: "wrong-host" },
              inputs: {},
            },
          },
        }),
      ).rejects.toThrow();
      const calls = h.harness.inspection.sdk.callsTo("threads.spawn");
      expect(calls).toHaveLength(2);
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
});

const agentsWrites = (h: Awaited<ReturnType<typeof setup>>) =>
  h.writes.filter((w) => String(w.path).endsWith("AGENTS.md"));

describe("AGENTS.md template", () => {
  const createSection = (h: Awaited<ReturnType<typeof setup>>, name: string) =>
    h.harness.behavior.callRpc("create", {
      projectId: "p1",
      folderId: null,
      name,
      relativePath: name.toLowerCase(),
    });

  it("seeds a new section with the managed template block", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({ agents_template: "Тише едешь." });
      await createSection(h, "Alpha");
      const agents = agentsWrites(h);
      expect(agents).toHaveLength(1);
      const content = String((agents[0] as { content: string }).content);
      expect(content).toContain("<!-- bb-project-folders:agents:start -->");
      expect(content).toContain("Тише едешь.");
      expect(content).toContain("<!-- bb-project-folders:agents:end -->");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("adopts existing AGENTS.md untouched instead of appending our block", async () => {
    const h = await setup();
    try {
      h.harness.inspection.sdk.stub("files.read", async (args) => {
        if (String(args.path).endsWith("CLAUDE.md"))
          throw new Error("ENOENT: no such file or directory");
        return { content: "# Мои правила\n", sha256: "old" };
      });
      await createSection(h, "Beta");
      expect(agentsWrites(h)).toHaveLength(0);
      const stub = h.writes.find((w) =>
        String(w.path).endsWith("/CLAUDE.md"),
      ) as { content?: string } | undefined;
      expect(stub?.content).toBe("@AGENTS.md\n");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("skips the write when the block is already up to date or disabled", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({ agents_template: "Одна строка" });
      const block =
        "<!-- bb-project-folders:agents:start -->\nОдна строка\n<!-- bb-project-folders:agents:end -->\n";
      h.harness.inspection.sdk.stub("files.read", async () => ({
        content: block,
        sha256: "same",
      }));
      await createSection(h, "Gamma");
      expect(agentsWrites(h)).toHaveLength(0);
      await h.harness.behavior.setSettings({ agents_auto_create: false });
      await h.harness.behavior.setSettings({ agents_template: "Другая" });
      await createSection(h, "Delta");
      expect(agentsWrites(h)).toHaveLength(0);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("applies the template to existing sections on demand", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({ agents_template: "Шаблон v2" });
      h.harness.inspection.sdk.stub("files.read", async () => ({
        content:
          "# Свои правила\n\n<!-- bb-project-folders:agents:start -->\nШаблон v1\n<!-- bb-project-folders:agents:end -->\n",
        sha256: "old",
      }));
      await createSection(h, "Epsilon");
      const result = (await h.harness.behavior.callRpc(
        "agents_apply",
        null,
      )) as { updated: number; unchanged: number; failed: number };
      expect(result).toMatchObject({ updated: 2, unchanged: 0, failed: 0 });
      expect(agentsWrites(h)).toHaveLength(2);
      const last = String(
        (agentsWrites(h).at(-1) as { content: string }).content,
      );
      expect(last.startsWith("# Свои правила\n")).toBe(true);
      expect(last).toContain("Шаблон v2");
      h.harness.inspection.sdk.stub("files.read", async () => {
        throw new Error("permission denied");
      });
      const failing = (await h.harness.behavior.callRpc(
        "agents_apply",
        null,
      )) as { failed: number; error: string | null };
      expect(failing.failed).toBe(2);
      expect(failing.error).toContain("permission denied");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("leaves hand-written AGENTS.md files out of the apply run", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({ agents_template: "Шаблон v2" });
      // No plugin markers: the file was written by hand, so it is left alone.
      h.harness.inspection.sdk.stub("files.read", async () => ({
        content: "# Свои правила\n",
        sha256: "old",
      }));
      await createSection(h, "Zeta");
      const before = agentsWrites(h).length;
      const result = (await h.harness.behavior.callRpc(
        "agents_apply",
        null,
      )) as { updated: number; failed: number };
      expect(result).toMatchObject({ updated: 0, failed: 0 });
      expect(agentsWrites(h)).toHaveLength(before);
      // The details pane reports that state as the "own file" mode.
      const read = (await h.harness.behavior.callRpc("rules_read", {
        projectId: "p1",
        folderId: null,
      })) as { mode: string };
      expect(read.mode).toBe("manual");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("writes nothing when a folder is kept on its own file", async () => {
    const h = await setup();
    try {
      h.harness.inspection.sdk.stub("files.read", async () => ({
        content: "# Свои правила\n",
        sha256: "old",
      }));
      const before = h.writes.length;
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: null,
        mode: "manual",
        sectionTemplate: "",
        projectTemplate: "",
        custom: "Только мои правила",
      });
      expect(h.writes).toHaveLength(before);
      const read = (await h.harness.behavior.callRpc("rules_read", {
        projectId: "p1",
        folderId: null,
      })) as { mode: string };
      expect(read.mode).toBe("manual");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("seeds subsections from a custom section template and stops at level three", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({ agents_template: "Общий шаблон" });
      const l1 = (await createSection(h, "L1")) as { id: string };
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: l1.id,
        mode: "custom",
        sectionTemplate: "Правила ветки L1",
      });
      const l2 = (await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: l1.id,
        name: "L2",
        relativePath: "l2",
      })) as { id: string };
      const l2Write = h.writes.find(
        (w) => String(w.path) === "/work/l1/l2/AGENTS.md",
      );
      expect(String((l2Write as { content: string }).content)).toContain(
        "Правила ветки L1",
      );
      const before = agentsWrites(h).length;
      const l3 = (await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: l2.id,
        name: "L3",
        relativePath: "l3",
      })) as { id: string };
      expect(
        h.writes.some((w) => String(w.path) === "/work/l1/l2/l3/AGENTS.md"),
      ).toBe(false);
      expect(agentsWrites(h)).toHaveLength(before);
      await expect(
        h.harness.behavior.callRpc("rules_read", {
          projectId: "p1",
          folderId: l3.id,
        }),
      ).rejects.toThrow(/first two levels/);
      await expect(
        h.harness.behavior.callRpc("rules_save", {
          projectId: "p1",
          folderId: l3.id,
          content: "x",
          sha: null,
        }),
      ).rejects.toThrow(/first two levels/);
      h.harness.inspection.sdk.stub("files.read", async (args) => {
        if (String(args.path).endsWith("/work/l1/AGENTS.md"))
          return { content: "# Свои\n", sha256: "old" };
        throw new Error("ENOENT: no such file or directory");
      });
      const result = (await h.harness.behavior.callRpc(
        "agents_apply",
        null,
      )) as { updated: number; unchanged: number; failed: number };
      expect(result.updated).toBe(3);
      const l1Apply = h.writes
        .filter((w) => String(w.path).endsWith("AGENTS.md"))
        .map((w) => String((w as { content: string }).content))
        .find((c) => c.includes("Правила ветки L1"));
      expect(l1Apply).toBeTruthy();
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("keeps export errors clean: transient states are not recorded, dead chats are dropped", async () => {
    const h = await setup();
    try {
      h.harness.inspection.sdk.stub("threads.get", async () => {
        throw Object.assign(new Error("HTTP 404: Thread not found"), {
          name: "BbHttpError",
        });
      });
      await expect(
        h.harness.behavior.callRpc("sync", { threadId: "gone" }),
      ).rejects.toThrow(/404/);
      h.harness.inspection.sdk.stub("threads.get", async () => {
        throw new Error("The chat does not have an environment yet.");
      });
      await expect(
        h.harness.behavior.callRpc("sync", { threadId: "draft" }),
      ).rejects.toThrow(/environment/);
      h.harness.inspection.sdk.stub("threads.get", async () => {
        throw new Error("boom");
      });
      await expect(
        h.harness.behavior.callRpc("sync", { threadId: "broken" }),
      ).rejects.toThrow(/boom/);
      const result = (await h.harness.behavior.callRpc("list", null)) as {
        errors: string[];
      };
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("broken");
      expect(result.errors[0]).toContain("boom");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("keeps separate templates for projects and sections", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.callRpc("agents_config_save", {
        autoCreate: true,
        template: "Правила разделов",
        projectTemplate: "Правила проекта",
        custom: "",
      });
      h.harness.inspection.sdk.stub("projects.create", async () => ({
        id: "p2",
      }));
      h.harness.inspection.sdk.stub("hosts.list", async () => [
        { id: "h1", name: "Mini", status: "connected" },
      ]);
      await h.harness.behavior.callRpc("project_create", {
        hostId: "h1",
        name: "Fresh",
        path: "/work/fresh",
      });
      const rootWrite = h.writes.find(
        (w) => String(w.path) === "/work/fresh/AGENTS.md",
      );
      expect(String((rootWrite as { content: string }).content)).toContain(
        "Правила проекта",
      );
      const config = (await h.harness.behavior.callRpc(
        "agents_config",
        null,
      )) as { template: string; projectTemplate: string };
      expect(config).toMatchObject({
        template: "Правила разделов",
        projectTemplate: "Правила проекта",
      });
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("writes saved custom rules into AGENTS.md and CLAUDE.md bottoms, and inherits shared ones", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({
        agents_custom: "Глобальное индивидуальное правило",
      });
      await createSection(h, "Eta");
      const seeded = String(
        (
          agentsWrites(h).find((w) => String(w.path).includes("eta")) as {
            content: string;
          }
        ).content,
      );
      expect(seeded).toContain("Глобальное индивидуальное правило");
      await h.harness.behavior.setSettings({ agents_custom: "" });
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: null,
        mode: "inherit",
        sectionTemplate: "",
        projectTemplate: "",
        custom: "Правило корня проекта",
      });
      const claude = h.writes.filter((w) =>
        String(w.path).endsWith("/work/CLAUDE.md"),
      );
      expect(claude.length).toBeGreaterThanOrEqual(1);
      // The final CLAUDE.md state is the one-line bridge to AGENTS.md.
      expect(String((claude.at(-1) as { content: string }).content)).toBe(
        "@AGENTS.md\n",
      );
      const rootAgents = h.writes.filter(
        (w) => String(w.path) === "/work/AGENTS.md",
      );
      expect(rootAgents).toHaveLength(1);
      expect(String((rootAgents[0] as { content: string }).content)).toContain(
        "Правило корня проекта",
      );
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("stamps a custom project template into AGENTS.md and bridges CLAUDE.md on every copy", async () => {
    const { h } = await twoDeviceSetup();
    try {
      await h.harness.behavior.callRpc("copy_add", {
        projectId: "p1",
        hostId: "h2",
        path: "/srv/selfy",
      });
      h.writes.length = 0;
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: null,
        mode: "custom",
        sectionTemplate: "",
        projectTemplate: "# Шаблон SelfyStudio",
        custom: "",
      });
      const agents = agentsWrites(h);
      expect(agents.map((w) => w.hostId).sort()).toEqual(["h1", "h2"]);
      for (const w of agents)
        expect(String((w as { content: string }).content)).toContain(
          "# Шаблон SelfyStudio",
        );
      const bridges = h.writes.filter((w) =>
        String(w.path).endsWith("CLAUDE.md"),
      );
      expect(bridges).toHaveLength(2);
      for (const w of bridges)
        expect(String((w as { content: string }).content)).toBe("@AGENTS.md\n");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("bridges Claude Code with a CLAUDE.md import without overwriting an existing one", async () => {
    const h = await setup();
    try {
      let claude: string | null = null;
      h.harness.inspection.sdk.stub("files.read", async (args) => {
        if (String(args.path).endsWith("CLAUDE.md")) {
          if (claude === null)
            throw new Error("ENOENT: no such file or directory");
          return { content: claude, sha256: "old" };
        }
        return "# Мои правила\n";
      });
      await createSection(h, "Theta");
      const stub = h.writes.find((w) =>
        String(w.path).endsWith("/CLAUDE.md"),
      ) as { content?: string } | undefined;
      expect(stub?.content).toBe("@AGENTS.md\n");
      claude = "@AGENTS.md\n";
      await createSection(h, "Iota");
      expect(
        h.writes.filter(
          (w) =>
            String(w.path).endsWith("/CLAUDE.md") &&
            String(w.path).includes("iota"),
        ),
      ).toHaveLength(0);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("reorders sibling sections and projects manually", async () => {
    const h = await setup();
    try {
      const a = (await createSection(h, "Alpha")) as { id: string };
      const b = (await createSection(h, "Beta")) as { id: string };
      await h.harness.behavior.callRpc("reorder", {
        kind: "sections",
        projectId: "p1",
        parentId: null,
        ids: [b.id, a.id],
      });
      let list = (await h.harness.behavior.callRpc("list", null)) as {
        folders: { id: string }[];
      };
      expect(list.folders.map((f) => f.id)).toEqual([b.id, a.id]);
      const c = (await createSection(h, "Gamma")) as { id: string };
      list = (await h.harness.behavior.callRpc("list", null)) as {
        folders: { id: string }[];
      };
      expect(list.folders.map((f) => f.id)).toEqual([b.id, a.id, c.id]);
      await expect(
        h.harness.behavior.callRpc("reorder", {
          kind: "sections",
          projectId: "p1",
          parentId: null,
          ids: [b.id],
        }),
      ).rejects.toThrow(/as a whole/);
      await expect(
        h.harness.behavior.callRpc("reorder", {
          kind: "projects",
          ids: ["unknown"],
        }),
      ).rejects.toThrow(/as a whole/);
      await h.harness.behavior.callRpc("reorder", {
        kind: "projects",
        ids: ["p1"],
      });
      const tree = (await h.harness.behavior.callRpc("list", null)) as {
        roots: { projectId: string }[];
      };
      expect(tree.roots.map((r) => r.projectId)).toEqual(["p1"]);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("lets a project override both templates for its own subtree", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({
        agents_template: "Общий шаблон разделов",
        agents_project_template: "Общий шаблон проектов",
      });
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: null,
        mode: "custom",
        sectionTemplate: "Шаблон разделов проекта",
        projectTemplate: "Шаблон этого проекта",
      });
      await createSection(h, "Under");
      const sectionWrite = h.writes.find(
        (w) => String(w.path) === "/work/under/AGENTS.md",
      );
      expect(String((sectionWrite as { content: string }).content)).toContain(
        "Шаблон разделов проекта",
      );
      const read = (await h.harness.behavior.callRpc("rules_read", {
        projectId: "p1",
        folderId: null,
      })) as { mode: string; template: string; projectTemplate: string };
      expect(read).toMatchObject({
        mode: "custom",
        template: "Шаблон разделов проекта",
        projectTemplate: "Шаблон этого проекта",
      });
      const applied = (await h.harness.behavior.callRpc(
        "agents_apply",
        null,
      )) as { updated: number };
      expect(applied.updated).toBeGreaterThanOrEqual(2);
      const rootApply = h.writes
        .filter((w) => String(w.path).endsWith("AGENTS.md"))
        .map((w) => String((w as { content: string }).content))
        .find((c) => c.includes("Шаблон этого проекта"));
      expect(rootApply).toBeTruthy();
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: null,
        mode: "inherit",
        sectionTemplate: "",
        projectTemplate: "",
      });
      const reset = (await h.harness.behavior.callRpc("rules_read", {
        projectId: "p1",
        folderId: null,
      })) as { mode: string };
      expect(reset.mode).toBe("inherit");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("inherits individual custom rules into the managed block", async () => {
    const h = await setup();
    try {
      await h.harness.behavior.setSettings({ agents_template: "Общий шаблон" });
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: null,
        mode: "inherit",
        sectionTemplate: "",
        custom: "Делегируй реализацию через Агентство.",
      });
      await createSection(h, "Zeta");
      const write = h.writes.find(
        (w) => String(w.path) === "/work/zeta/AGENTS.md",
      ) as { content?: string } | undefined;
      expect(write?.content).toContain("Общий шаблон");
      expect(write?.content).toContain(
        "<!-- bb-project-folders:custom:start -->",
      );
      expect(write?.content).toContain("Делегируй реализацию через Агентство.");
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
});
describe("project folder boundaries", () => {
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

async function twoDeviceSetup() {
  const h = await setup();
  const sources: {
    id?: string;
    type: "local_path";
    hostId: string;
    path: string;
    isDefault: boolean;
  }[] = [{ type: "local_path", hostId: "h1", path: "/work", isDefault: true }];
  h.harness.inspection.sdk.stub("projects.list", async () => [
    { ...root, sources },
  ]);
  h.harness.inspection.sdk.stub("hosts.list", async () => [
    { id: "h1", name: "Mac Mini", status: "connected" },
    { id: "h2", name: "OVH", status: "connected" },
  ]);
  h.harness.inspection.sdk.stub("projects.sources.add", async (args) => {
    const added = {
      id: `s${sources.length + 1}`,
      type: "local_path" as const,
      hostId: (args as { hostId: string }).hostId,
      path: (args as { path: string }).path,
      isDefault: false,
    };
    sources.push(added);
    return added;
  });
  h.harness.inspection.sdk.stub("projects.sources.delete", async (args) => {
    const i = sources.findIndex(
      (s) => s.id === (args as { sourceId: string }).sourceId,
    );
    if (i >= 0) sources.splice(i, 1);
    return { ok: true };
  });
  h.harness.inspection.sdk.stub("projects.sources.update", async (args) => {
    const s = sources.find(
      (s) => s.id === (args as { sourceId: string }).sourceId,
    );
    if (s && (args as { path?: string }).path)
      s.path = (args as { path: string }).path;
    return s;
  });
  return { h, sources };
}

describe("multi-device working copies", () => {
  it("adds a working copy on another device: source, folder and AGENTS.md", async () => {
    const { h, sources } = await twoDeviceSetup();
    try {
      let list = (await h.harness.behavior.callRpc("list", null)) as {
        roots: { hostId: string; path: string }[];
        machines: { id: string; name: string }[];
      };
      expect(list.roots).toHaveLength(1);
      expect(list.machines.map((m) => m.name)).toEqual(["Mac Mini", "OVH"]);
      await h.harness.behavior.callRpc("copy_add", {
        projectId: "p1",
        hostId: "h2",
        path: "/srv/selfy",
      });
      expect(
        h.writes.some(
          (w) => w.hostId === "h2" && String(w.path).startsWith("/srv/selfy"),
        ),
      ).toBe(true);
      expect(sources).toHaveLength(2);
      list = (await h.harness.behavior.callRpc("list", null)) as never;
      expect(list.roots.map((r) => r.hostId).sort()).toEqual(["h1", "h2"]);
      const agents = agentsWrites(h).filter(
        (w) => w.hostId === "h2" && String(w.path).startsWith("/srv/selfy"),
      );
      expect(agents).toHaveLength(1);
      await expect(
        h.harness.behavior.callRpc("copy_add", {
          projectId: "p1",
          hostId: "h2",
          path: "/srv/other",
        }),
      ).rejects.toThrow(/already has a copy/);
      await expect(
        h.harness.behavior.callRpc("copy_add", {
          projectId: "p1",
          hostId: "h1",
          path: "relative/path",
        }),
      ).rejects.toThrow(/absolute/);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("creates a section and spawns a chat against the second device root", async () => {
    const { h } = await twoDeviceSetup();
    try {
      await h.harness.behavior.callRpc("copy_add", {
        projectId: "p1",
        hostId: "h2",
        path: "/srv/selfy",
      });
      const section = (await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: null,
        hostId: "h2",
        name: "Server",
        relativePath: "server",
      })) as { id: string };
      expect(
        h.writes.some(
          (w) => w.hostId === "h2" && w.path === "/srv/selfy/server",
        ),
      ).toBe(true);
      h.harness.inspection.sdk.stub("threads.spawn", async () =>
        makeThreadResponse({ id: "t2", projectId: "p1" }),
      );
      h.harness.inspection.sdk.stub("threads.get", async () =>
        makeThreadResponse({
          id: "t2",
          projectId: "p1",
          environmentId: null,
        }),
      );
      await h.harness.behavior.callRpc("spawn", {
        projectId: "p1",
        folderId: null,
        hostId: "h2",
        request: {
          projectId: "p1",
          providerId: "codex",
          model: "selected-model",
          reasoningLevel: "medium",
          permissionMode: "full",
          environment: {
            type: "provider",
            environmentProviderId: "project-checkout",
            machine: { type: "existing", hostId: "h2" },
          },
          input: [],
          executionInputSources: {},
        },
      });
      const calls = h.harness.inspection.sdk.callsTo("threads.spawn");
      expect(JSON.stringify(calls)).toContain("/srv/selfy");
      void section;
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });

  it("refuses to remove the last copy or a copy with sections or chats", async () => {
    const { h, sources } = await twoDeviceSetup();
    try {
      sources.push({
        id: "s2",
        type: "local_path",
        hostId: "h2",
        path: "/srv/selfy",
        isDefault: false,
      });
      await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: null,
        hostId: "h2",
        name: "Server",
        relativePath: "server",
      });
      await expect(
        h.harness.behavior.callRpc("copy_remove", {
          projectId: "p1",
          hostId: "h2",
        }),
      ).rejects.toThrow(/sections in the tree/);
      h.harness.inspection.sdk.stub("environments.list", async () => [
        { id: "e1", projectId: "p1", hostId: "h1", path: "/work" },
      ]);
      await expect(
        h.harness.behavior.callRpc("copy_remove", {
          projectId: "p1",
          hostId: "h1",
        }),
      ).rejects.toThrow(/chats/);
      h.harness.inspection.sdk.stub("environments.list", async () => []);
      await expect(
        h.harness.behavior.callRpc("copy_remove", {
          projectId: "p1",
          hostId: "h1",
        }),
      ).resolves.toMatchObject({ ok: true });
      expect(sources).toHaveLength(1);
      await expect(
        h.harness.behavior.callRpc("copy_remove", {
          projectId: "p1",
          hostId: "h2",
        }),
      ).rejects.toThrow(/last working copy/);
      await expect(
        h.harness.behavior.callRpc("copy_remove", {
          projectId: "p1",
          hostId: "unknown",
        }),
      ).rejects.toThrow(/no copy/);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
});

describe("project rules across device copies", () => {
  it("writes project custom rules to the AGENTS.md of every device copy", async () => {
    const { h } = await twoDeviceSetup();
    try {
      await h.harness.behavior.callRpc("copy_add", {
        projectId: "p1",
        hostId: "h2",
        path: "/srv/selfy",
      });
      h.writes.length = 0;
      await h.harness.behavior.callRpc("rules_settings_save", {
        projectId: "p1",
        folderId: null,
        mode: "inherit",
        sectionTemplate: "",
        custom: "Индивидуальные правила проекта",
      });
      const agents = agentsWrites(h);
      expect(agents.map((w) => w.hostId).sort()).toEqual(["h1", "h2"]);
      expect((agents.map((w) => String(w.path)) as string[]).sort()).toEqual([
        "/srv/selfy/AGENTS.md",
        "/work/AGENTS.md",
      ]);
      expect(
        agents.every((w) =>
          String((w as { content: string }).content).includes(
            "Индивидуальные правила проекта",
          ),
        ),
      ).toBe(true);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
});

describe("repointing a copy to a new path", () => {
  it("updates the source and remaps its sections", async () => {
    const { h, sources } = await twoDeviceSetup();
    try {
      await h.harness.behavior.callRpc("copy_add", {
        projectId: "p1",
        hostId: "h2",
        path: "/srv/old",
      });
      const section = (await h.harness.behavior.callRpc("create", {
        projectId: "p1",
        folderId: null,
        hostId: "h2",
        name: "Server",
        relativePath: "server",
      })) as { id: string };
      await h.harness.behavior.callRpc("copy_edit", {
        projectId: "p1",
        hostId: "h2",
        path: "/srv/new",
      });
      const list = (await h.harness.behavior.callRpc("list", null)) as {
        roots: { hostId: string; path: string }[];
        folders: { id: string; path: string }[];
      };
      expect(list.roots.find((r) => r.hostId === "h2")?.path).toBe("/srv/new");
      expect(list.folders.find((f) => f.id === section.id)?.path).toBe(
        "/srv/new/server",
      );
      expect(sources.find((s) => s.hostId === "h2")?.path).toBe("/srv/new");
      // Chat on the moved root still resolves to the new path.
      h.harness.inspection.sdk.stub("threads.get", async () =>
        makeThreadResponse({ id: "t9", projectId: "p1", environmentId: "e9" }),
      );
      h.harness.inspection.sdk.stub("environments.get", async () => ({
        projectId: "p1",
        hostId: "h2",
        path: "/srv/new",
      }));
      h.harness.inspection.sdk.stub("threads.timeline", async () => ({
        rows: [],
        timelinePage: { hasOlderRows: false, olderCursor: null },
      }));
      await expect(
        h.harness.behavior.callRpc("sync", { threadId: "t9" }),
      ).resolves.toMatchObject({ path: "/srv/new/.bb/chats/t9" });
      await expect(
        h.harness.behavior.callRpc("copy_edit", {
          projectId: "p1",
          hostId: "h2",
          path: "relative",
        }),
      ).rejects.toThrow(/absolute/);
      // A folder used by ANOTHER project on the same device is rejected;
      // the same path on a different device would be fine.
      h.harness.inspection.sdk.stub("projects.list", async () => [
        { ...root, sources },
        {
          id: "p2",
          name: "Other",
          sources: [
            {
              id: "s9",
              type: "local_path",
              hostId: "h2",
              path: "/srv/other",
              isDefault: true,
            },
          ],
        },
      ]);
      await expect(
        h.harness.behavior.callRpc("copy_edit", {
          projectId: "p1",
          hostId: "h2",
          path: "/srv/other",
        }),
      ).rejects.toThrow(/already connected/);
    } finally {
      await h.harness.lifecycle.dispose();
    }
  });
});
