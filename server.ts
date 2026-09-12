import { randomUUID } from "node:crypto";
import path from "node:path";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import type { NewThreadRequest } from "@get-bb/plugin-sdk/app";
import { z } from "zod";
import { makeArchives, archiveSchema } from "./archive";

const folderSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  hostId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  path: z.string(),
});
export type Folder = z.infer<typeof folderSchema>;
const targetSchema = z.object({
  projectId: z.string().min(1),
  folderId: z.string().nullable(),
  hostId: z.string().min(1).optional(),
});
const createSchema = targetSchema.extend({
  name: z.string().trim().min(1).max(120),
  relativePath: z.string().trim().min(1).max(1000),
  allowFresh: z.boolean().optional(),
});
const requestSchema = z.object({
  projectId: z.string(),
  providerId: z.string(),
  model: z.string(),
  reasoningLevel: z.string(),
  permissionMode: z.string(),
  environment: z.record(z.string(), z.json()),
  input: z.array(z.json()),
  executionInputSources: z.record(z.string(), z.json()),
  serviceTier: z.string().optional(),
  sendAt: z.number().int().optional(),
});
export type ComposerRequest = z.input<typeof requestSchema>;
export const rpcContract = defineRpcContract({
  list: {
    input: z.null(),
    output: z.object({
      folders: z.array(folderSchema),
      roots: z.array(folderSchema),
      bindings: z.record(z.string(), z.string()),
      errors: z.array(z.string()),
    }),
  },
  machines: {
    input: z.null(),
    output: z.object({
      machines: z.array(
        z.object({ id: z.string(), name: z.string(), connected: z.boolean() }),
      ),
    }),
  },
  project_browse: {
    input: z.object({ hostId: z.string().min(1), path: z.string().optional() }),
    output: z.object({
      path: z.string(),
      parent: z.string().nullable(),
      directories: z.array(z.object({ name: z.string(), path: z.string() })),
    }),
  },
  project_create: {
    input: z.object({
      hostId: z.string().min(1),
      name: z.string().trim().min(1).max(120),
      path: z.string().trim().min(1),
    }),
    output: z.object({ id: z.string() }),
  },
  archive_list: {
    input: z.null(),
    output: z.object({ archives: z.array(archiveSchema) }),
  },
  archive_matches: {
    input: createSchema,
    output: z.object({ archives: z.array(archiveSchema) }),
  },
  archive: { input: z.object({ folderId: z.string() }), output: archiveSchema },
  restore: { input: z.object({ id: z.string() }), output: folderSchema },
  create: { input: createSchema, output: folderSchema },
  locations: {
    input: targetSchema,
    output: z.object({
      locations: z.array(
        z.object({
          hostId: z.string(),
          name: z.string(),
          path: z.string().nullable(),
          available: z.boolean(),
          reason: z.string().nullable(),
        }),
      ),
    }),
  },
  browse: {
    input: targetSchema.extend({ relative: z.string() }),
    output: z.object({
      relative: z.string(),
      directories: z.array(
        z.object({ name: z.string(), relative: z.string() }),
      ),
    }),
  },
  rename: {
    input: targetSchema.extend({ name: z.string().trim().min(1).max(120) }),
    output: z.object({ ok: z.boolean() }),
  },
  forget: { input: targetSchema, output: z.object({ ok: z.boolean() }) },
  rules_read: {
    input: targetSchema,
    output: z.object({
      content: z.string(),
      sha: z.string().nullable(),
      path: z.string(),
    }),
  },
  rules_save: {
    input: targetSchema.extend({
      content: z.string().max(100000),
      sha: z.string().nullable(),
    }),
    output: z.object({ ok: z.boolean() }),
  },
  spawn: {
    input: targetSchema.extend({ request: requestSchema }),
    output: z.object({ id: z.string() }),
  },
  sync: {
    input: z.object({ threadId: z.string() }),
    output: z.object({ path: z.string() }),
  },
});
export function resolveFolderPath(root: string, relative: string) {
  if (
    path.isAbsolute(relative) ||
    relative
      .split(/[\\/]/)
      .some((p) => p === ".." || p === ".bb" || p === ".git") ||
    /[\x00-\x1f]/.test(relative)
  )
    throw new Error(
      "Enter a relative path inside the section; .bb and .git are reserved.",
    );
  const result = path.resolve(root, relative);
  if (
    result === path.resolve(root) ||
    !result.startsWith(path.resolve(root) + path.sep)
  )
    throw new Error("The folder must be inside its parent section.");
  return result;
}
export default async function plugin(bb: BbPluginApi) {
  const db = bb.storage.database();
  bb.storage.migrate(db, [
    `CREATE TABLE folders (id TEXT PRIMARY KEY, projectId TEXT NOT NULL, hostId TEXT NOT NULL, parentId TEXT, name TEXT NOT NULL, path TEXT NOT NULL, UNIQUE(projectId,hostId,path))`,
    `CREATE TABLE exports (threadId TEXT PRIMARY KEY, path TEXT, error TEXT, updatedAt INTEGER)`,
    `CREATE TABLE folder_archives (id TEXT PRIMARY KEY, createdAt INTEGER NOT NULL, data TEXT NOT NULL)`,
  ]);
  const folders = () =>
    db.prepare("SELECT * FROM folders ORDER BY name").all() as Folder[];
  async function roots() {
    const projects = await bb.sdk.projects.list();
    return projects.flatMap((p) => {
      const s = p.sources.find((s) => s.isDefault) ?? p.sources[0];
      return s?.type === "local_path"
        ? [
            {
              id: p.id,
              projectId: p.id,
              hostId: s.hostId,
              parentId: null,
              name: p.name,
              path: s.path,
            },
          ]
        : [];
    });
  }
  async function target(input: z.infer<typeof targetSchema>): Promise<Folder> {
    if (!input.folderId && input.hostId) {
      const project = (await bb.sdk.projects.list()).find(
        (p) => p.id === input.projectId,
      );
      const source = project?.sources.find(
        (s) => s.type === "local_path" && s.hostId === input.hostId,
      );
      if (!project || !source || source.type !== "local_path")
        throw new Error(
          "This project has no folder on the selected device. Add a project source in BB.",
        );
      return {
        id: project.id,
        projectId: project.id,
        hostId: source.hostId,
        parentId: null,
        name: project.name,
        path: source.path,
      };
    }
    const f = input.folderId
      ? folders().find((f) => f.id === input.folderId)
      : (await roots()).find((f) => f.projectId === input.projectId);
    if (!f || f.projectId !== input.projectId)
      throw new Error("Section or project source not found.");
    if (input.hostId && f.hostId !== input.hostId)
      throw new Error("A nested section must use its parent folder’s device.");
    return f;
  }
  const changed = () => bb.realtime.publish("changed", {});
  async function create(input: z.infer<typeof createSchema>) {
    const parent = await target(input);
    if (archives.moving(parent.hostId, parent.path))
      throw new Error(
        "The section is moving. Try again after the operation finishes.",
      );
    if (
      !input.allowFresh &&
      archives.matches(parent.projectId, parent.hostId, input.name).length
    )
      throw new Error(
        "An archived section has this name. Restore it or explicitly create a new section.",
      );
    const folder: Folder = {
      id: randomUUID(),
      projectId: parent.projectId,
      hostId: parent.hostId,
      parentId: input.folderId,
      name: input.name,
      path: resolveFolderPath(parent.path, input.relativePath),
    };
    if (
      folders().some(
        (f) =>
          f.projectId === folder.projectId &&
          f.hostId === folder.hostId &&
          f.path === folder.path,
      )
    )
      throw new Error("This path is already in the tree.");
    await bb.sdk.files.mkdir({
      hostId: folder.hostId,
      path: folder.path,
      rootPath: parent.path,
      recursive: true,
    });
    await bb.sdk.files.mkdir({
      hostId: folder.hostId,
      path: path.join(folder.path, ".bb/chats"),
      rootPath: folder.path,
      recursive: true,
    });
    db.prepare(
      "INSERT INTO folders VALUES (@id,@projectId,@hostId,@parentId,@name,@path)",
    ).run(folder);
    changed();
    return folder;
  }
  async function locate(threadId: string) {
    const t = await bb.sdk.threads.get({ threadId });
    if (!t.environmentId)
      throw new Error("The chat does not have an environment yet.");
    const env = await bb.sdk.environments.get({
      environmentId: t.environmentId,
    });
    const root = await target({
      projectId: t.projectId,
      folderId: null,
      hostId: env.hostId,
    }).catch(() => null);
    const f =
      folders().find(
        (f) =>
          f.projectId === t.projectId &&
          f.hostId === env.hostId &&
          f.path === env.path,
      ) ?? (root?.path === env.path ? root : null);
    if (!f)
      throw new Error("The chat working folder is not registered in the tree.");
    return { t, f };
  }
  const syncing = new Map<string, Promise<{ path: string }>>();
  async function exportChat(threadId: string) {
    const { t, f } = await locate(threadId);
    const dir = path.join(f.path, ".bb/chats", threadId);
    const write = async (name: string, content: string) => {
      await bb.sdk.files.write({
        hostId: f.hostId,
        rootPath: f.path,
        path: path.join(dir, name),
        content,
        createParents: true,
      });
    };
    await write(
      "thread.json",
      JSON.stringify(
        {
          id: t.id,
          title: t.title,
          projectId: t.projectId,
          folderId: f.id,
          workspace: f.path,
          exportedAt: new Date().toISOString(),
          canonicalStorage: "BB database",
        },
        null,
        2,
      ),
    );
    const snapshot = randomUUID();
    let previous: string | null = null;
    try {
      const old = await bb.sdk.files.read({
        hostId: f.hostId,
        rootPath: f.path,
        path: path.join(dir, "history/index.json"),
      });
      const index = JSON.parse(old.content);
      if (
        typeof index.snapshot === "string" &&
        /^[a-f0-9-]{36}$/.test(index.snapshot)
      )
        previous = index.snapshot;
    } catch {}
    let cursor: { anchorSeq: number; anchorId: string } | null = null;
    let page = 0;
    do {
      const timeline = await bb.sdk.threads.timeline({
        threadId,
        segmentLimit: "50",
        includeNestedRows: "true",
        ...(cursor
          ? {
              beforeAnchorSeq: String(cursor.anchorSeq),
              beforeAnchorId: cursor.anchorId,
            }
          : {}),
      });
      await write(
        `history/${snapshot}/page-${String(page++).padStart(5, "0")}.json`,
        JSON.stringify(timeline, null, 2),
      );
      cursor = timeline.timelinePage.hasOlderRows
        ? timeline.timelinePage.olderCursor
        : null;
      if (page > 10000) throw new Error("History is too large for one export.");
    } while (cursor);
    await write(
      "history/index.json",
      JSON.stringify(
        {
          snapshot,
          pages: page,
          order: "newest-first",
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    if (previous)
      await bb.sdk.files
        .remove({
          hostId: f.hostId,
          rootPath: f.path,
          path: path.join(dir, "history", previous),
          recursive: true,
        })
        .catch((e) => bb.log.debug(String(e)));
    await write(
      "README.md",
      "# Chat files\n\nthread.json contains chat metadata. history/index.json indexes the full history (newest pages first).\nartifacts/ holds documents and results, notes/ holds notes, tmp/ holds temporary files.\nBB remains the canonical chat store; this is an automatically updated copy.\n",
    );
    for (const name of ["artifacts", "notes", "tmp"])
      await bb.sdk.files.mkdir({
        hostId: f.hostId,
        rootPath: f.path,
        path: path.join(dir, name),
        recursive: true,
      });
    db.prepare("INSERT OR REPLACE INTO exports VALUES (?,?,NULL,?)").run(
      threadId,
      dir,
      Date.now(),
    );
    return { path: dir };
  }
  function sync(threadId: string) {
    if (archives.blocked(threadId)) return Promise.resolve({ path: "" });
    const active = syncing.get(threadId);
    if (active) return active;
    const task = exportChat(threadId)
      .catch((e) => {
        db.prepare("INSERT OR REPLACE INTO exports VALUES (?,NULL,?,?)").run(
          threadId,
          String(e),
          Date.now(),
        );
        throw e;
      })
      .finally(() => syncing.delete(threadId));
    syncing.set(threadId, task);
    return task;
  }
  const archives = makeArchives(bb, {
    folders,
    root: (projectId, hostId) => target({ projectId, hostId, folderId: null }),
    sync,
    pending: () => Promise.allSettled([...syncing.values()]),
    changed,
  });
  bb.experimental_hooks.on("message.dispatch", (ctx) => {
    const intent = ctx.environmentIntent;
    const inputs = intent?.kind === "provider" ? intent.inputs : null;
    const requestedPath =
      ctx.environment?.path ??
      (inputs &&
      typeof inputs === "object" &&
      !Array.isArray(inputs) &&
      typeof inputs.path === "string"
        ? inputs.path
        : null);
    return archives.blocked(ctx.thread.id) ||
      (requestedPath && ctx.host && archives.moving(ctx.host.id, requestedPath))
      ? {
          action: "reject",
          message:
            "The chat section is archived or moving. Restore it in Projects & Sections.",
        }
      : { action: "proceed" };
  });
  bb.rpc.register(rpcContract, {
    archive_list: async () => ({ archives: archives.list() }),
    archive_matches: async (input) => {
      const f = await target(input);
      return { archives: archives.matches(f.projectId, f.hostId, input.name) };
    },
    archive: ({ folderId }) => archives.archive(folderId),
    restore: ({ id }) => archives.restore(id),
    list: async () => {
      const all = await bb.sdk.environments.list();
      const fs = folders();
      const bindings: Record<string, string> = {};
      for (const e of all) {
        const f = fs.find(
          (f) =>
            f.hostId === e.hostId &&
            f.projectId === e.projectId &&
            f.path === e.path,
        );
        if (f) bindings[e.id] = f.id;
      }
      return {
        folders: fs,
        roots: await roots(),
        bindings,
        errors: (
          db
            .prepare(
              "SELECT threadId,error FROM exports WHERE error IS NOT NULL LIMIT 10",
            )
            .all() as { threadId: string; error: string }[]
        ).map((e) => `${e.threadId}: ${e.error}`),
      };
    },
    machines: async () => ({
      machines: (await bb.sdk.hosts.list()).map((h) => ({
        id: h.id,
        name: h.name,
        connected: h.status === "connected",
      })),
    }),
    project_browse: async (input) => {
      const h = (await bb.sdk.hosts.list()).find(
        (h) => h.id === input.hostId && h.status === "connected",
      );
      if (!h) throw new Error("The device is offline.");
      const d = await bb.sdk.hosts.directory(input);
      return {
        path: d.directory,
        parent: d.parent,
        directories: d.entries
          .filter((e) => e.kind === "directory" && !e.name.startsWith("."))
          .map((e) => ({ name: e.name, path: e.path })),
      };
    },
    project_create: async (input) => {
      if (!path.isAbsolute(input.path) || /[\x00-\x1f]/.test(input.path))
        throw new Error("Enter an absolute project folder path.");
      const p = path.normalize(input.path);
      const h = (await bb.sdk.hosts.list()).find(
        (h) => h.id === input.hostId && h.status === "connected",
      );
      if (!h) throw new Error("The device is offline.");
      const projects = await bb.sdk.projects.list();
      if (
        projects.some((project) =>
          project.sources.some(
            (s) => s.type === "local_path" && s.hostId === h.id && s.path === p,
          ),
        )
      )
        throw new Error("This folder is already connected as a project.");
      await bb.sdk.files.mkdir({ hostId: h.id, path: p, recursive: true });
      const project = await bb.sdk.projects.create({
        name: input.name,
        source: { type: "local_path", hostId: h.id, path: p },
      });
      changed();
      return { id: project.id };
    },
    create,
    locations: async (input) => {
      const hosts = await bb.sdk.hosts.list();
      const project = (await bb.sdk.projects.list()).find(
        (p) => p.id === input.projectId,
      );
      if (!project) throw new Error("Project not found.");
      const parent = input.folderId ? await target(input) : null;
      return {
        locations: hosts.map((h) => {
          const source = project.sources.find(
            (s) => s.type === "local_path" && s.hostId === h.id,
          );
          const p = parent
            ? parent.hostId === h.id
              ? parent.path
              : null
            : source?.type === "local_path"
              ? source.path
              : null;
          const reason =
            h.status !== "connected"
              ? "Device offline"
              : parent && parent.hostId !== h.id
                ? "The parent section is on another device"
                : !p
                  ? "This project has no folder on this device"
                  : null;
          return {
            hostId: h.id,
            name: h.name,
            path: p,
            available: reason === null,
            reason,
          };
        }),
      };
    },
    browse: async (input) => {
      const f = await target(input);
      const p = input.relative
        ? resolveFolderPath(f.path, input.relative)
        : f.path;
      const d = await bb.sdk.hosts.directory({ hostId: f.hostId, path: p });
      return {
        relative: input.relative,
        directories: d.entries
          .filter((e) => e.kind === "directory" && !e.name.startsWith("."))
          .map((e) => ({
            name: e.name,
            relative: path.relative(f.path, e.path),
          })),
      };
    },
    rename: async (input) => {
      const f = await target(input);
      if (input.folderId)
        db.prepare("UPDATE folders SET name=? WHERE id=?").run(
          input.name,
          f.id,
        );
      else
        await bb.sdk.projects.update({
          projectId: f.projectId,
          name: input.name,
        });
      changed();
      return { ok: true };
    },
    forget: async (input) => {
      if (!input.folderId)
        throw new Error("Archive the project separately using BB.");
      await archives.archive(input.folderId);
      return { ok: true };
    },
    rules_read: async (input) => {
      const f = await target(input);
      const p = path.join(f.path, "AGENTS.md");
      try {
        const file = await bb.sdk.files.read({
          hostId: f.hostId,
          path: p,
          rootPath: f.path,
        });
        return { content: file.content, sha: file.sha256, path: p };
      } catch (e) {
        if (!/not.found|ENOENT|does not exist/i.test(String(e))) throw e;
        return { content: "", sha: null, path: p };
      }
    },
    rules_save: async (input) => {
      const f = await target(input);
      const r = await bb.sdk.files.write({
        hostId: f.hostId,
        rootPath: f.path,
        path: path.join(f.path, "AGENTS.md"),
        content: input.content,
        expectedSha256: input.sha,
      });
      if (r.outcome === "conflict")
        throw new Error("AGENTS.md changed. Reopen the rules before saving.");
      return { ok: true };
    },
    spawn: async (input) => {
      const f = await target(input);
      if (input.request.projectId !== f.projectId)
        throw new Error(
          "The composer project must match the selected section.",
        );
      const req = input.request as NewThreadRequest;
      if (
        req.environment.type === "host" &&
        ((req.environment.hostId && req.environment.hostId !== f.hostId) ||
          req.environment.workspace.type !== "unmanaged")
      )
        throw new Error(
          "A section chat uses that section’s device and folder. Select a working copy on its device.",
        );
      if (req.environment.type === "reuse") {
        const e = await bb.sdk.environments.get({
          environmentId: req.environment.environmentId,
        });
        if (e.hostId !== f.hostId || e.path !== f.path)
          throw new Error(
            "The selected environment does not match the section folder.",
          );
      }
      if (req.environment.type === "provider")
        throw new Error(
          "Select a working copy on the section’s device for this chat.",
        );
      const branch =
        req.environment.type === "host" &&
        req.environment.workspace.type === "unmanaged"
          ? req.environment.workspace.branch
          : undefined;
      const t = await bb.sdk.threads.spawn({
        ...req,
        projectId: f.projectId,
        environment: {
          type: "host",
          hostId: f.hostId,
          workspace: {
            type: "unmanaged",
            path: f.path,
            ...(branch ? { branch } : {}),
          },
        },
      });
      sync(t.id).catch((e) => bb.log.warn(String(e)));
      changed();
      return { id: t.id };
    },
    sync: ({ threadId }) => sync(threadId),
  });
  bb.agents.configure((ctx) => ({
    tools: [],
    skills: ["project-folders"],
    instructions:
      ctx.project.kind === "standard" && ctx.environment.path
        ? `Store this chat's supporting files in ${path.join(ctx.environment.path, ".bb/chats", ctx.thread.id)}: documents and reports in artifacts/, notes in notes/, temporary files in tmp/. Create directories as needed. Keep conversation artifacts out of the working folder root. Place source code and project files according to the task. Do not edit automatically exported thread.json or history/. Read applicable AGENTS.md files, including parent folder rules.`
        : undefined,
  }));
  for (const event of [
    "thread.idle",
    "thread.archived",
    "thread.created",
  ] as const)
    bb.events.on(event, async ({ thread }) => {
      try {
        await locate(thread.id);
        await sync(thread.id);
        changed();
      } catch (e) {
        bb.log.debug(`Chat export ${thread.id}: ${String(e)}`);
      }
    });
  bb.cli.register({
    name: "project-folders",
    summary: "Project sections and chat history",
    commands: [
      {
        name: "archives",
        summary: "List section archives",
        usage: "bb project-folders archives",
      },
      {
        name: "archive",
        summary: "Move a section into its project archive",
        usage: "bb project-folders archive <folder-id>",
      },
      {
        name: "restore",
        summary: "Restore a section and its chats from the archive",
        usage: "bb project-folders restore <archive-id>",
      },
      {
        name: "list",
        summary: "List sections",
        usage: "bb project-folders list",
      },
      {
        name: "create",
        usage:
          "bb project-folders create <project-id> <parent-id-or-dash> <name> <relative-path> [host-id]",
        summary: "Create a section in a project or parent section",
      },
      {
        name: "forget",
        summary: "Compatibility alias for archiving a section",
        usage: "bb project-folders forget <folder-id>",
      },
      {
        name: "sync",
        usage: "bb project-folders sync <thread-id>",
        summary: "Export chat history: sync <thread-id>",
      },
    ],
    async run(argv) {
      try {
        const args = argv.filter((a) => a !== "--json");
        let value: unknown;
        if (args[0] === "list")
          value = { folders: folders(), roots: await roots() };
        else if (args[0] === "create")
          value = await create(
            createSchema.parse({
              projectId: args[1],
              folderId: args[2] === "-" ? null : args[2],
              name: args[3],
              relativePath: args[4],
              hostId: args[5],
            }),
          );
        else if (args[0] === "forget" || args[0] === "archive") {
          value = await archives.archive(z.string().min(1).parse(args[1]));
        } else if (args[0] === "restore") {
          value = await archives.restore(z.string().min(1).parse(args[1]));
        } else if (args[0] === "archives") {
          value = archives.list();
        } else if (args[0] === "sync")
          value = await sync(z.string().min(1).parse(args[1]));
        else
          return {
            exitCode: 0,
            stdout:
              "bb project-folders list | create <project-id> <parent-id-or-dash> <name> <relative-path> [host-id] | sync <thread-id> | archives | archive <folder-id> | restore <archive-id>",
          };
        return { exitCode: 0, stdout: JSON.stringify(value, null, 2) };
      } catch (e) {
        return { exitCode: 1, stderr: String(e) };
      }
    },
  });
}
