import { describe, expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "./server";
import { SECTION_ENVIRONMENT_ID } from "./section-tree";

const project = {
  id: "p1",
  name: "Test",
  sources: [
    { type: "local_path", hostId: "h1", path: "/work", isDefault: true },
  ],
};
async function server() {
  const h = createFakePluginHost({
    pluginId: "project-folders",
    agentSkillIds: ["project-folders"],
    sdk: {
      projects: { list: async () => [project] as never },
      hosts: {
        list: async () =>
          [{ id: "h1", name: "Mac", status: "connected" }] as never,
      },
      files: {
        mkdir: async () => ({}) as never,
        read: async () => {
          throw new Error("ENOENT: no such file or directory");
        },
        write: async () => ({ outcome: "written", sha256: "s", sizeBytes: 1 }),
      },
      environments: { list: async () => [] },
    },
  });
  await plugin(h.bb);
  const created = (await h.harness.behavior.callRpc("create", {
    projectId: "p1",
    folderId: null,
    name: "Website",
    relativePath: "Website",
  })) as { id: string };
  const provider = h.harness.inspection.registrations.environmentProviders.get(
    SECTION_ENVIRONMENT_ID,
  )!;
  return { h, folderId: created.id, provider };
}
const context = (folderId: string, hostId = "h1", projectId = "p1") =>
  ({
    project: { id: projectId },
    host: { id: hostId },
    inputs: { folderId },
  }) as never;

describe("the section as a place BB can run a chat in", () => {
  it("offers a project section and points it at the section folder", async () => {
    const x = await server();
    try {
      expect(x.provider.displayName).toBe("Project section");
      expect(x.provider.requires.projectCheckout).toBe(true);
      expect(await x.provider.validate!(context(x.folderId))).toEqual({
        action: "accept",
      });
      expect(await x.provider.create(context(x.folderId))).toEqual({
        status: "created",
        path: "/work/Website",
        // The folder belongs to the project: retiring the chat must not touch it.
        ownsPath: false,
      });
      expect(await x.provider.remove({} as never)).toEqual({
        status: "removed",
      });
    } finally {
      await x.h.harness.lifecycle.dispose();
    }
  });
  it("refuses a section of another project, another device, or one that is gone", async () => {
    const x = await server();
    try {
      for (const ctx of [
        context(x.folderId, "h1", "other"),
        context(x.folderId, "h2"),
        context("missing"),
      ]) {
        expect(await x.provider.validate!(ctx)).toMatchObject({
          action: "refuse",
        });
        expect(await x.provider.create(ctx)).toMatchObject({
          status: "failed",
        });
      }
    } finally {
      await x.h.harness.lifecycle.dispose();
    }
  });
});
