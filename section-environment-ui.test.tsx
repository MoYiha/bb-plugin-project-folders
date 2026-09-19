// @vitest-environment jsdom
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { installTestMatchMedia } from "./test-match-media";
import {
  composerEnvironmentId,
  environmentLabel,
  sectionOptions,
  SECTION_ENVIRONMENT_ID,
} from "./section-tree";

const root = {
  id: "p1",
  projectId: "p1",
  hostId: "h1",
  parentId: null,
  path: "/work",
  name: "Project",
};
const section = { ...root, id: "f1", path: "/work/Website", name: "Website" };
const nested = {
  ...root,
  id: "f2",
  parentId: "f1",
  path: "/work/Website/Design",
  name: "Design",
};
const group = { ...root, id: "g1", name: "Group", kind: "group" as const };
const remote = { ...root, id: "f3", hostId: "h2", name: "Server" };

describe("the control BB renders for it", () => {
  let app: Awaited<ReturnType<typeof loadPluginApp>>;
  beforeAll(async () => {
    installTestMatchMedia();
    app = await loadPluginApp(() => import("./app"));
  });
  afterEach(cleanup);
  it("keeps parents before children and counts the depth", () => {
    const options = sectionOptions(
      { folders: [nested, section, remote], roots: [root] },
      "p1",
      "h1",
    );
    expect(options.map((o) => [o.folder.name, o.depth])).toEqual([
      ["Website", 0],
      ["Design", 1],
    ]);
  });
  it("submits the chosen section and leaves groups out", async () => {
    const registration = app.environmentProviderInputs.find(
      (r) => r.environmentProviderId === SECTION_ENVIRONMENT_ID,
    )!;
    const changes: unknown[] = [];
    const view = renderSlot(
      { id: "inputs", component: registration.component },
      {
        projectId: "p1",
        target: { kind: "existing-host", hostId: "h1" },
        value: null,
        onChange: (next: unknown) => changes.push(next),
      },
      {
        rpc: {
          list: () => ({
            folders: [section, nested, group, remote],
            roots: [root],
            bindings: {},
            places: {},
            errors: [],
            machines: [{ id: "h1", name: "Mac", connected: true }],
          }),
        },
      },
    );
    const select = (await waitFor(() =>
      view.getByLabelText("Project section"),
    )) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      "Choose a project section",
      "Website",
      "Design",
    ]);
    fireEvent.change(select, { target: { value: "f2" } });
    expect(changes).toEqual([{ status: "ready", value: { folderId: "f2" } }]);
    view.lifecycle.unmount();
  });
  it("blocks submission instead of sending a section that is gone", async () => {
    const registration = app.environmentProviderInputs.find(
      (r) => r.environmentProviderId === SECTION_ENVIRONMENT_ID,
    )!;
    const changes: { status: string }[] = [];
    const view = renderSlot(
      { id: "inputs", component: registration.component },
      {
        projectId: "p1",
        target: { kind: "existing-host", hostId: "h1" },
        value: { folderId: "archived" },
        onChange: (next: { status: string }) => changes.push(next),
      },
      {
        rpc: {
          list: () => ({
            folders: [section],
            roots: [root],
            bindings: {},
            places: {},
            errors: [],
            machines: [{ id: "h1", name: "Mac", connected: true }],
          }),
        },
      },
    );
    await waitFor(() => expect(changes).toHaveLength(1));
    expect(changes[0]).toMatchObject({ status: "blocked" });
    view.lifecycle.unmount();
  });
});

describe("the line naming the section under BB's own composer", () => {
  it("names the section of the environment the composer reuses", () => {
    const tree = {
      folders: [section, nested],
      roots: [root],
      bindings: { "env-1": "f2" },
    };
    expect(environmentLabel(tree, "env-1")).toEqual({
      label: "Project / Website / Design",
      path: "/work/Website/Design",
    });
    // An environment outside the tree is BB's own business.
    expect(environmentLabel(tree, "env-unknown")).toBeNull();
  });
  it("reads only a reused environment out of BB's picker keys", () => {
    const session = {
      getItem: (k: string) =>
        ({
          "bb.promptbox.environment-p1-1": "reuse:env-1",
          "bb.promptbox.environment-p2-1": "provider:project-checkout",
        })[k] ?? null,
    };
    expect(composerEnvironmentId("p1", session)).toBe("env-1");
    expect(composerEnvironmentId("p2", session)).toBeNull();
    expect(composerEnvironmentId(null, session)).toBeNull();
    expect(
      composerEnvironmentId("p1", {
        getItem: () => {
          throw new Error("storage is blocked");
        },
      }),
    ).toBeNull();
  });
});
