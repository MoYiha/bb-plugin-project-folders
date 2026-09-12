import path from "node:path";
import { z } from "zod";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Folder } from "./server";
const jobSchema = z.object({
  threadId: z.string(),
  projectId: z.string(),
  hostId: z.string(),
  from: z.string(),
  to: z.string(),
  source: z.string(),
  destination: z.string(),
});
export function makeThreadMoves(
  bb: BbPluginApi,
  options: {
    target: (input: {
      projectId: string;
      folderId: string | null;
      hostId?: string;
    }) => Promise<Folder>;
    allowed: (threadId: string, folder: Folder) => void;
    pendingExports: () => Promise<unknown>;
    canonical: (hostId: string, path: string) => string;
    changed: () => void;
  },
) {
  const db = bb.storage.database();
  const blocked = (id: string) =>
    !!db.prepare("SELECT threadId FROM thread_moves WHERE threadId=?").get(id);
  const any = () =>
    !!db.prepare("SELECT threadId FROM thread_moves LIMIT 1").get();
  const running = new Set<string>();
  async function move(input: {
    threadId: string;
    projectId: string;
    folderId: string | null;
    hostId?: string;
  }) {
    if (running.has(input.threadId))
      throw new Error("This chat is already moving.");
    running.add(input.threadId);
    try {
      const thread = await bb.sdk.threads.get({ threadId: input.threadId });
      if (thread.projectId !== input.projectId || !thread.environmentId)
        throw new Error("Choose a section in this chat's project.");
      if (thread.archivedAt || !["idle", "error"].includes(thread.status))
        throw new Error(
          "Wait for the chat and its queued messages to finish before moving it.",
        );
      const environment = await bb.sdk.environments.get({
        environmentId: thread.environmentId,
      });
      const folder = await options.target(input);
      if (!environment.path || environment.hostId !== folder.hostId)
        throw new Error("Choose a section on the same device.");
      options.allowed(thread.id, folder);
      const saved = db
        .prepare("SELECT data FROM thread_moves WHERE threadId=?")
        .get(thread.id) as { data: string } | undefined;
      const from = options.canonical(environment.hostId, environment.path);
      const job = saved
        ? jobSchema.parse(JSON.parse(saved.data))
        : {
            threadId: thread.id,
            projectId: thread.projectId,
            hostId: folder.hostId,
            from,
            to: folder.path,
            source: path.join(from, ".bb/chats", thread.id),
            destination: path.join(folder.path, ".bb/chats", thread.id),
          };
      if (job.to !== folder.path)
        throw new Error("Finish the previous move to " + job.to + " first.");
      if (job.from === job.to) return { path: job.to };
      let existence = (
        await bb.sdk.hosts.pathsExist({
          hostId: job.hostId,
          paths: [job.source, job.destination],
        })
      ).existence;
      if (existence[job.source] && existence[job.destination])
        throw new Error(
          "Both chat storage folders exist. No files were overwritten.",
        );
      db.prepare("INSERT OR REPLACE INTO thread_moves VALUES (?,?)").run(
        thread.id,
        JSON.stringify(job),
      );
      await options.pendingExports();
      existence = (
        await bb.sdk.hosts.pathsExist({
          hostId: job.hostId,
          paths: [job.source, job.destination],
        })
      ).existence;
      if (existence[job.source] && existence[job.destination]) {
        if (!saved)
          db.prepare("DELETE FROM thread_moves WHERE threadId=?").run(
            thread.id,
          );
        throw new Error(
          "Both chat storage folders exist. No files were overwritten.",
        );
      }
      if (from !== job.to) {
        const request = {
          threadId: thread.id,
          experimental_directory: {
            path: job.to,
            expectedEnvironmentId: thread.environmentId,
          },
        };
        try {
          const updated = await bb.sdk.threads.update(request);
          const next = updated.environmentId
            ? await bb.sdk.environments.get({
                environmentId: updated.environmentId,
              })
            : null;
          if (next?.path !== job.to || next.hostId !== job.hostId)
            throw new Error(
              "This BB server does not support native chat relocation yet. Install the BB directory-update API first.",
            );
        } catch (error) {
          const current = await bb.sdk.threads.get({ threadId: thread.id });
          if (current.environmentId === thread.environmentId)
            db.prepare("DELETE FROM thread_moves WHERE threadId=?").run(
              thread.id,
            );
          throw error;
        }
      }
      if (existence[job.source]) {
        await bb.sdk.files.mkdir({
          hostId: job.hostId,
          path: path.dirname(job.destination),
          recursive: true,
        });
        await bb.sdk.files.move({
          hostId: job.hostId,
          sourcePath: job.source,
          destinationPath: job.destination,
        });
      }
      db.prepare("DELETE FROM thread_moves WHERE threadId=?").run(thread.id);
      options.changed();
      return { path: job.to };
    } finally {
      running.delete(input.threadId);
    }
  }
  return { move, blocked, any };
}
