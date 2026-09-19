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
  /** Epoch ms the chat was asked to switch its own directory. */
  asked: z.number().optional(),
});
/**
 * BB has no plugin API for moving an existing chat's working directory
 * (get-bb/bb#3904), but every chat's own agent has the `update_environment_
 * directory` tool. So when core refuses, the move asks the chat to finish it:
 * one agent-only message, carrying this marker so the dispatch guard lets it
 * past the very barrier it is meant to lift.
 */
export const RELOCATE_MARKER = "[project-folders:relocate]";
export const relocationRequest = (to: string) =>
  `${RELOCATE_MARKER} Your working directory has moved to ${to}. Call update_environment_directory with exactly that path, then reply with one short line naming the new directory. Do no other work in this turn; the files of this chat are being moved by Projects & Sections.`;
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
    /** The move landed: the chat is listed by its new folder, not by hand. */
    settled?: (threadId: string) => void;
  },
) {
  const db = bb.storage.database();
  /**
   * A barrier stops a chat only while its files are in flight. A chat that was
   * merely asked to switch directory has moved nothing yet, so it keeps
   * working normally — an agent that ignores the request must not lock its
   * own chat out.
   */
  const blocked = (id: string) => {
    const row = db
      .prepare("SELECT data FROM thread_moves WHERE threadId=?")
      .get(id) as { data: string } | undefined;
    if (!row) return false;
    const parsed = jobSchema.safeParse(JSON.parse(row.data));
    return !parsed.success || !parsed.data.asked;
  };
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
          expectedEnvironmentId: thread.environmentId,
          path: job.to,
        };
        const switched = await switchDirectory(thread.id, request);
        if (!switched) {
          // Core refused the switch, so the chat performs it itself. The job
          // stays on the barrier until its environment really is the new
          // folder; `finish` moves the files then.
          db.prepare("INSERT OR REPLACE INTO thread_moves VALUES (?,?)").run(
            thread.id,
            JSON.stringify({ ...job, asked: Date.now() }),
          );
          await bb.sdk.threads.send({
            threadId: thread.id,
            // The chat is idle by now; "start" keeps this a turn of its own.
            mode: "start",
            input: [
              {
                type: "text",
                text: relocationRequest(job.to),
                mentions: [],
                visibility: "agent-only",
              },
            ],
          });
          options.changed();
          return { path: job.to, asked: true };
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
      return { path: job.to, asked: false };
    } finally {
      running.delete(input.threadId);
    }
  }
  /**
   * Asks core to repoint the chat. Returns false when this BB has no such API
   * — the documented case (get-bb/bb#3904), not an error to surface.
   */
  async function switchDirectory(
    threadId: string,
    request: { expectedEnvironmentId: string; path: string },
  ) {
    try {
      const updated = await bb.sdk.threads.update({
        threadId,
        experimental_directory: {
          path: request.path,
          expectedEnvironmentId: request.expectedEnvironmentId,
        },
      } as Parameters<typeof bb.sdk.threads.update>[0]);
      const next = updated.environmentId
        ? await bb.sdk.environments.get({ environmentId: updated.environmentId })
        : null;
      return next?.path === request.path;
    } catch {
      return false;
    }
  }
  /**
   * Completes a move the chat was asked to finish: once its environment is the
   * destination, the chat's own storage follows and the barrier lifts. Called
   * whenever a chat goes idle, so it costs nothing while nothing is pending.
   */
  async function finish(threadId: string) {
    const saved = db
      .prepare("SELECT data FROM thread_moves WHERE threadId=?")
      .get(threadId) as { data: string } | undefined;
    if (!saved) return false;
    const job = jobSchema.parse(JSON.parse(saved.data));
    if (!job.asked) return false;
    const thread = await bb.sdk.threads.get({ threadId });
    if (!thread.environmentId) return false;
    const environment = await bb.sdk.environments.get({
      environmentId: thread.environmentId,
    });
    if (environment.path !== job.to || environment.hostId !== job.hostId)
      return false;
    // Exports in flight write into the old storage folder: let them land.
    await options.pendingExports();
    const { existence } = await bb.sdk.hosts.pathsExist({
      hostId: job.hostId,
      paths: [job.source, job.destination],
    });
    if (existence[job.source] && !existence[job.destination]) {
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
    db.prepare("DELETE FROM thread_moves WHERE threadId=?").run(threadId);
    options.settled?.(threadId);
    options.changed();
    return true;
  }
  return { move, blocked, any, finish };
}
