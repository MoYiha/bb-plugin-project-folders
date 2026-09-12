import { describe, it, expect } from "vitest";
import {
  createFakePluginHost,
  makeThreadResponse,
} from "@get-bb/plugin-sdk/testing";
import { makeThreadMoves } from "./thread-move";
import { z } from "zod";
async function setup({
  supported = true,
  failFiles = false,
  status = "idle",
}: {
  supported?: boolean;
  failFiles?: boolean;
  status?: "idle" | "active";
} = {}) {
  let thread = makeThreadResponse({
    id: "t1",
    projectId: "p1",
    environmentId: "e1",
    status,
  });
  const files = new Set(["/work/.bb/chats/t1"]);
  let fail = failFiles;
  const h = createFakePluginHost({
    pluginId: "project-folders",
    sdk: {
      threads: {
        get: async () => thread,
        update: async (input) => {
          if (supported) {
            z.object({
              experimental_directory: z.object({
                path: z.literal("/work/section"),
                expectedEnvironmentId: z.literal("e1"),
              }),
            }).parse(input);
            thread = { ...thread, environmentId: "e2" };
          }
          return thread;
        },
      },
      environments: {
        get: async ({ environmentId }) =>
          ({
            id: environmentId,
            hostId: "h1",
            path: environmentId === "e1" ? "/work" : "/work/section",
          }) as never,
      },
      hosts: {
        pathsExist: async ({ paths }) =>
          ({
            existence: Object.fromEntries(paths.map((p) => [p, files.has(p)])),
          }) as never,
      },
      files: {
        mkdir: async () => ({}) as never,
        move: async ({ sourcePath, destinationPath }) => {
          if (fail) throw new Error("Disk unavailable");
          files.delete(sourcePath);
          files.add(destinationPath);
          return {} as never;
        },
      },
    },
  });
  h.bb.storage.migrate(h.bb.storage.database(), [
    "CREATE TABLE thread_moves (threadId TEXT PRIMARY KEY, data TEXT NOT NULL)",
  ]);
  const options = {
    target: async () => ({
      id: "f1",
      projectId: "p1",
      hostId: "h1",
      path: "/work/section",
      parentId: null,
      name: "Section",
    }),
    allowed: () => {},
    pendingExports: async () => {},
    canonical: (_host: string, p: string) => p,
    changed: () => {},
  };
  return {
    h,
    files,
    options,
    current: () => thread,
    recover: () => {
      fail = false;
    },
    moves: makeThreadMoves(h.bb, options),
  };
}
const input = { threadId: "t1", projectId: "p1", folderId: "f1", hostId: "h1" };
describe("native chat relocation", () => {
  it("preserves the chat and moves only its dedicated storage", async () => {
    const x = await setup();
    try {
      await x.moves.move(input);
      expect(x.current()).toMatchObject({ id: "t1", environmentId: "e2" });
      expect([...x.files]).toEqual(["/work/section/.bb/chats/t1"]);
      expect(x.moves.blocked("t1")).toBe(false);
    } finally {
      await x.h.harness.lifecycle.dispose();
    }
  });
  it("does not move files or leave a barrier when the core ignores an unsupported API field", async () => {
    const x = await setup({ supported: false });
    try {
      await expect(x.moves.move(input)).rejects.toThrow("does not support");
      expect(x.current().environmentId).toBe("e1");
      expect([...x.files]).toEqual(["/work/.bb/chats/t1"]);
      expect(x.moves.blocked("t1")).toBe(false);
    } finally {
      await x.h.harness.lifecycle.dispose();
    }
  });
  it("recovers a failed storage move using its durable journal", async () => {
    const x = await setup({ failFiles: true });
    try {
      await expect(x.moves.move(input)).rejects.toThrow("Disk unavailable");
      expect(x.moves.blocked("t1")).toBe(true);
      x.recover();
      const resumed = makeThreadMoves(x.h.bb, x.options);
      await resumed.move(input);
      expect(resumed.blocked("t1")).toBe(false);
      expect([...x.files]).toEqual(["/work/section/.bb/chats/t1"]);
    } finally {
      await x.h.harness.lifecycle.dispose();
    }
  });
  it("rejects active chats and another project before changing anything", async () => {
    const x = await setup({ status: "active" });
    try {
      await expect(x.moves.move(input)).rejects.toThrow("Wait for the chat");
      await expect(
        x.moves.move({ ...input, projectId: "other" }),
      ).rejects.toThrow("this chat's project");
      expect(x.current().environmentId).toBe("e1");
    } finally {
      await x.h.harness.lifecycle.dispose();
    }
  });
});
